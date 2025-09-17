import path from 'path';
import os from 'os';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { execFile } from 'child_process';
import { and, inArray, eq } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import { buildObjectSearchConditions, buildCounts, makeExportResult } from '../handlers/exportHandlers.js';

const SEP = ' || ';
const ensureDir = (p) => fsPromises.mkdir(p, { recursive: true });
const csvEsc = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s === '') return '';
  return '"' + s.replace(/"/g, '""') + '"';
};
async function writeCsv(filePath, header, rows) {
  const lines = [header.map(csvEsc).join(',')];
  for (const r of rows) lines.push(r.map(csvEsc).join(','));
  await ensureDir(path.dirname(filePath));
  await fsPromises.writeFile(filePath, lines.join('\n'), 'utf-8');
}
function zipFolder(folderPath, zipPath) {
  const isWin = process.platform === 'win32';
  if (!isWin) throw new Error('ZIP export currently supported only on Windows environment');
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile','-Command',`Compress-Archive -Path "${folderPath}/*" -DestinationPath "${zipPath}" -Force`];
    execFile('powershell', args, { windowsHide: true }, (err, stdout, stderr) => err ? reject(new Error(`ZIP failed: ${stderr || err.message}`)) : resolve(true));
  });
}
const idx = (rows, k='id') => Object.fromEntries(rows.map(r=>[r?.[k], r]));
const by = (rows, k) => rows.reduce((m,r)=>{const v=r?.[k]; if(v==null) return m; (m[v]||(m[v]=[])).push(r); return m;},{});
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const tryJSON = (v)=>{try{return typeof v==='string'?JSON.parse(v):v;}catch{return v;}};

// Static schema references (centralized)
const CSV_TEXT_FIELD_LABEL_MAP = {
  institutions: { name_id: 'name', description_id: 'description', country_id: 'country', location_id: 'location' },
  ontology_fields: { name_id: 'name', description_id: 'description', category_id: 'category' },
  datasources: { name_id: 'name', method_id: 'method', notes_id: 'notes' },
  research_fields: { name_id: 'name', description_id: 'description' },
  vocabularies: { option_id: 'option', description_id: 'description' }
};

export async function exportProjectCsv(options,{ db }){
  const { filePath, filters={}, includeAssets = false } = options||{};
  if (!filePath || !filePath.toLowerCase().endsWith('.zip')) throw new Error('filePath must be a .zip path for CSV export');
  if (!filters?.project_id) throw new Error('project_id is required in filters');

  const conditions = buildObjectSearchConditions(filters);
  const idRows = await db.select({ id: dbSchema.objects.id }).from(dbSchema.objects).where(and(...conditions)).execute();
  const objectIds = idRows.map(r=>r.id);

  const outRoot = path.join(os.tmpdir(), `export_csv_${filters.project_id}_${Date.now()}`);
  const dataDir = path.join(outRoot,'data');
  await ensureDir(dataDir);

  if (objectIds.length===0){
    await fsPromises.writeFile(path.join(outRoot,'README.txt'),'No objects matched the filters.','utf-8');
    await zipFolder(outRoot, filePath);
    try{ await fsPromises.rm(outRoot,{recursive:true,force:true}); }catch{}
    return makeExportResult({ filePath, zipped:true, counts: buildCounts({}), fallbackMode:'csv' });
  }

  // preload
  const [objects, oassets, oofs, orfs] = await Promise.all([
    db.select().from(dbSchema.objects).where(inArray(dbSchema.objects.id, objectIds)).execute(),
    db.select().from(dbSchema.objects_assets).where(inArray(dbSchema.objects_assets.object_id, objectIds)).execute(),
    db.select().from(dbSchema.objects_ontology_fields).where(inArray(dbSchema.objects_ontology_fields.object_id, objectIds)).execute(),
    db.select().from(dbSchema.objects_research_fields).where(inArray(dbSchema.objects_research_fields.object_id, objectIds)).execute(),
  ]);
  const assetIds = uniq(oassets.map(r=>r.asset_id));
  const [assets, assetsInst] = await Promise.all([
    assetIds.length? db.select().from(dbSchema.assets).where(inArray(dbSchema.assets.id, assetIds)).execute():[],
    assetIds.length? db.select().from(dbSchema.assets_institutions).where(inArray(dbSchema.assets_institutions.asset_id, assetIds)).execute():[],
  ]);
  const instIds = uniq([
    ...objects.map(o=>o.institution_id),
    ...assets.map(a=>a.institution_id),
    ...assetsInst.map(ai=>ai.institution_id)
  ]);
  const institutions = instIds.length? await db.select().from(dbSchema.institutions).where(inArray(dbSchema.institutions.id, instIds)).execute():[];

  const rfIds = uniq(orfs.map(r=>r.field_id));
  const researchFields = rfIds.length? await db.select().from(dbSchema.research_fields).where(inArray(dbSchema.research_fields.id, rfIds)).execute():[];
  const vocabIds = uniq(orfs.map(r=>r.vocabulary_id));
  const [vocabularies, vga] = await Promise.all([
    vocabIds.length? db.select().from(dbSchema.vocabularies).where(inArray(dbSchema.vocabularies.id, vocabIds)).execute():[],
    vocabIds.length? db.select().from(dbSchema.vocabularies_generic_assets).where(inArray(dbSchema.vocabularies_generic_assets.vocabulary_id, vocabIds)).execute():[],
  ]);
  const gaIds = uniq([ ...vga.map(r=>r.generic_asset_id), ...vocabularies.map(v=>v.main_asset_id) ]);
  const genericAssets = gaIds.length? await db.select().from(dbSchema.genericAssets).where(inArray(dbSchema.genericAssets.id, gaIds)).execute():[];

  const dsIds = uniq(oofs.map(r=>r.datasources_id));
  const [datasources, ontologyFields] = await Promise.all([
    dsIds.length? db.select().from(dbSchema.datasources).where(inArray(dbSchema.datasources.id, dsIds)).execute():[],
    uniq(oofs.map(r=>r.field_id)).length? db.select().from(dbSchema.ontology_fields).where(inArray(dbSchema.ontology_fields.id, uniq(oofs.map(r=>r.field_id)))).execute():[],
  ]);

  // texts (centralized using CSV_TEXT_FIELD_LABEL_MAP)
  const textSet = new Set();
  const pushT = (id)=>{ if(id) textSet.add(id); };
  const TABLE_ROWS = {
    institutions,
    ontology_fields: ontologyFields,
    datasources,
    research_fields: researchFields,
    vocabularies
  };
  Object.entries(CSV_TEXT_FIELD_LABEL_MAP).forEach(([tbl, labels])=>{
    const rows = TABLE_ROWS[tbl] || [];
    rows.forEach(r => {
      Object.keys(labels).forEach(idKey => pushT(r[idKey]));
    });
  });
  const textIds = Array.from(textSet);
  const [texts, languages] = await Promise.all([
    textIds.length? db.select().from(dbSchema.texts).where(inArray(dbSchema.texts.id, textIds)).execute():[],
    filters.project_id? db.select().from(dbSchema.languages).where(eq(dbSchema.languages.project_id, filters.project_id)).execute():[]
  ]);
  const languageIds = languages.map(l=>l.id);
  const translations = (textIds.length && languageIds.length)
    ? await db.select().from(dbSchema.translations).where(and(
        inArray(dbSchema.translations.text_id, textIds),
        inArray(dbSchema.translations.language_id, languageIds)
      )).execute()
    : [];
  const iText = idx(texts);
  const byTextTrans = by(translations,'text_id');
  const tcont = (id)=> (iText[id]?.content)||'';
  const expandText = (textId)=>{
    if (!textId) return {};
    const t = iText[textId];
    if (!t) return {};
    const map = {};
    const orig = languages.find(l=> l.id === t.original_language_id);
    if (orig && t.content) map[orig.code] = t.content;
    const trs = byTextTrans[textId] || [];
    trs.forEach(tr=>{
      const lang = languages.find(l=> l.id === tr.language_id);
      if (lang && tr.content) map[lang.code] = tr.content;
    });
    return map;
  };
  const langCodes = languages.map(l=>l.code);

  // indices
  const iAssets = idx(assets);
  const byObjAssets = by(oassets,'object_id');
  const byObjOrfs = by(orfs,'object_id');
  const byVocabGA = by(vga,'vocabulary_id');
  const iInst = idx(institutions);
  const iVoc = idx(vocabularies);
  const iGA = idx(genericAssets);
  const iRF = idx(researchFields);
  const iDS = idx(datasources);
  const iOF = idx(ontologyFields);
  const byObjOofs = by(oofs,'object_id');

  // OBJECTS.csv
  const rfList = researchFields.slice().sort((a,b)=>String(tcont(a.name_id)).localeCompare(String(tcont(b.name_id))));
  const instNameHeaders = (langCodes.length? langCodes.map(c=>`institution_name_${c}`): ['institution_name']);
  const objHeader = ['obj_id','primary_id','institution_id', ...instNameHeaders,'assets_ids','assets_filenames'];
  rfList.forEach((_,i)=>{ 
    objHeader.push(`research_field_${i+1}_id`);
    if (langCodes.length) langCodes.forEach(c=> objHeader.push(`research_field_${i+1}_label_${c}`));
    else objHeader.push(`research_field_${i+1}_label`);
  });
  const objRows = objects.map(o=>{
    const oas = (byObjAssets[o.id]||[]).slice().sort((a,b)=> (a.order??0)-(b.order??0));
    const primary = (byObjOofs[o.id]?.find(r=>r.primary === 1)?.value) || '';
    const ids = oas.map(x=>x.asset_id).join(SEP);
    const fns = oas.map(x=>iAssets[x.asset_id]?.filename||'').join(SEP);
    const inst = iInst[o.institution_id];
    const instNameMap = inst? expandText(inst.name_id): null;
    const instNameCols = langCodes.length? langCodes.map(c=> (instNameMap?.[c]||'')) : [inst? tcont(inst.name_id):''];
    const rfByField = byObjOrfs[o.id]||[];
    const rfPairs = rfList.map(f=>{
      const vals = rfByField.filter(r=>r.field_id===f.id);
      const idList = vals.map(v=> v.vocabulary_id||'');
      if (langCodes.length){
        const labelCols = langCodes.map(c=>{
          const lbls = vals.map(v=>{
            if (v.vocabulary_id){
              const map = expandText(iVoc[v.vocabulary_id]?.option_id);
              return map[c]||'';
            }
            return v.value||'';
          });
          return lbls.join(SEP);
        });
        return [idList.join(SEP), ...labelCols];
      } else {
        const labels = vals.map(v=> v.vocabulary_id? (tcont(iVoc[v.vocabulary_id]?.option_id)||'') : (v.value||''));
        return [idList.join(SEP), labels.join(SEP)];
      }
    });
    return [o.id, primary, o.institution_id||'', ...instNameCols, ids, fns, ...rfPairs.flat()];
  });
  await writeCsv(path.join(dataDir,'objects.csv'), objHeader, objRows);

  // INSTITUTIONS.csv
  const nameHs = langCodes.length? langCodes.map(c=>`name_${c}`): ['name'];
  const descHs = langCodes.length? langCodes.map(c=>`description_${c}`): ['description'];
  const countryHs = langCodes.length? langCodes.map(c=>`country_${c}`): ['country'];
  const locationHs = langCodes.length? langCodes.map(c=>`location_${c}`): ['location'];
  const instHeader = ['id', ...nameHs, ...descHs, ...countryHs, ...locationHs, 'lon','lat','website','links','project_id','logo'];
  const flatLinks = (links)=>{
    const v = tryJSON(links);
    if (!v) return '';
    if (Array.isArray(v)) return v.map(x=> typeof x==='object' ? `${x.label||''}:${x.url||''}` : String(x)).join(SEP);
    if (typeof v==='object') return Object.entries(v).map(([k,val])=>`${k}:${val}`).join(SEP);
    return String(v);
  };
  const instRows = institutions.map(i=>[
    i.id,
    ...(langCodes.length? langCodes.map(c=> (expandText(i.name_id)?.[c]||'')) : [tcont(i.name_id)]),
    ...(langCodes.length? langCodes.map(c=> (expandText(i.description_id)?.[c]||'')) : [tcont(i.description_id)]),
    ...(langCodes.length? langCodes.map(c=> (expandText(i.country_id)?.[c]||'')) : [tcont(i.country_id)]),
    ...(langCodes.length? langCodes.map(c=> (expandText(i.location_id)?.[c]||'')) : [tcont(i.location_id)]),
    i.lon??'', i.lat??'', i.website||'', flatLinks(i.links), i.project_id||'', i.logo||''
  ]);
  await writeCsv(path.join(dataDir,'institutions.csv'), instHeader, instRows);

  // ASSETS.csv
  const propKeys = uniq(assets.flatMap(a=>{ const p = tryJSON(a.properties)||{}; return (p && typeof p==='object')? Object.keys(p):[]; }));
  const assetHeader = ['id','filename','file_type','size', ...propKeys.map(k=>`metadata_${k}`)];
  const assetRows = await Promise.all(assets.map(async a=>{
    let size='';
    try{ if(a.path) size = String((await fsPromises.stat(a.path)).size); }catch{}
    const p = tryJSON(a.properties)||{};
    const cols = propKeys.map(k=>{
      const v = p[k];
      if (Array.isArray(v)) return v.map(x=> typeof x==='object'? JSON.stringify(x): String(x)).join(SEP);
      if (v && typeof v==='object') return JSON.stringify(v);
      return v??'';
    });
    return [a.id, a.filename||'', a.type||'', size, ...cols];
  }));
  await writeCsv(path.join(dataDir,'assets.csv'), assetHeader, assetRows);

  // RESEARCH_FIELDS.csv
  const rfNameHs = langCodes.length? langCodes.map(c=>`name_${c}`): ['name'];
  const rfDescHs = langCodes.length? langCodes.map(c=>`description_${c}`): ['description'];
  const rfHeader = ['id', ...rfNameHs, ...rfDescHs, 'type'];
  const rfRows = researchFields.map(f=>{
    const nameMap = expandText(f.name_id);
    const descMap = expandText(f.description_id);
    const names = langCodes.length? langCodes.map(c=> (nameMap?.[c]||'')) : [tcont(f.name_id)];
    const descs = langCodes.length? langCodes.map(c=> (descMap?.[c]||'')) : [tcont(f.description_id)];
    return [f.id, ...names, ...descs, f.type||''];
  });
  await writeCsv(path.join(dataDir,'research_fields.csv'), rfHeader, rfRows);

  // VOCABULARIES.csv (only those used)
  const rfNameVocHs = langCodes.length? langCodes.map(c=>`research_field_name_${c}`): ['research_field_name'];
  const valLabelHs = langCodes.length? langCodes.map(c=>`value_label_${c}`): ['value_label'];
  const valDescHs = langCodes.length? langCodes.map(c=>`value_description_${c}`): ['value_description'];
  const vocHeader = ['research_field_id', ...rfNameVocHs, 'value_id', ...valLabelHs, ...valDescHs, 'media_id','media_filename'];
  const vocRows = vocabularies.map(v=>{
    const ga = v.main_asset_id? iGA[v.main_asset_id]:null;
    const rf = iRF[v.field_id];
    const rfNameMap = rf? expandText(rf.name_id): null;
    const rfNames = langCodes.length? langCodes.map(c=> (rfNameMap?.[c]||'')) : [rf? tcont(rf.name_id):''];
    const labelMap = expandText(v.option_id);
    const descMap = expandText(v.description_id);
    const labels = langCodes.length? langCodes.map(c=> (labelMap?.[c]||'')) : [tcont(v.option_id)];
    const descs = langCodes.length? langCodes.map(c=> (descMap?.[c]||'')) : [tcont(v.description_id)];
    return [v.field_id||'', ...rfNames, v.id, ...labels, ...descs, v.main_asset_id||'', ga?.filename||''];
  });
  await writeCsv(path.join(dataDir,'vocabularies.csv'), vocHeader, vocRows);

  // INSTITUTION DATA per object (object_ontology_fields)
  const instDataDir = path.join(dataDir,'institution_data');
  await ensureDir(instDataDir);
  for (const o of objects){
    const rows = (by(oofs,'object_id')[o.id]||[]).map(r=>{
      const ds = iDS[r.datasources_id];
      const dsNameMap = ds? expandText(ds.name_id): null;
      const of = iOF[r.field_id];
      const ofNameMap = of? expandText(of.name_id): null;
      const dsNames = langCodes.length? langCodes.map(c=> (dsNameMap?.[c]||'')) : [ds? tcont(ds.name_id):''];
      const ofNames = langCodes.length? langCodes.map(c=> (ofNameMap?.[c]||'')) : [of? tcont(of.name_id):''];
      return [r.datasources_id||'', ...dsNames, ds?.date??'', ...ofNames, r.label||'', r.value||''];
    });
    const dsNameHs = langCodes.length? langCodes.map(c=>`data_source_name_${c}`): ['data_source_name'];
    const ofNameHs = langCodes.length? langCodes.map(c=>`institution_field_${c}`): ['institution_field'];
    const header = ['data_source_id', ...dsNameHs, 'data_source_date', ...ofNameHs, 'matched_field_label','value'];
    await writeCsv(path.join(instDataDir, `${o.id}.csv`), header, rows);
  }

  // Optionally copy binary assets and generic assets into the ZIP
  if (includeAssets) {
    const assetsDir = path.join(outRoot, 'assets');
    await ensureDir(assetsDir);
    // Copy generic assets referenced by vocabularies
    for (const ga of genericAssets) {
      if (!ga?.path) continue;
      try {
        const base = ga.filename || String(ga.id);
        await fsPromises.copyFile(ga.path, path.join(assetsDir, base));
      } catch {}
    }
    // Copy object-linked assets
    for (const a of assets) {
      if (!a?.path) continue;
      try {
        const base = a.filename || String(a.id);
        await fsPromises.copyFile(a.path, path.join(assetsDir, base));
      } catch {}
    }
  }

  const counts = buildCounts({ objects, assets, institutions });
  await zipFolder(outRoot, filePath);
  try{ await fsPromises.rm(outRoot,{recursive:true,force:true}); }catch{}
  return makeExportResult({ filePath, zipped:true, counts, fallbackMode:'csv' });
}