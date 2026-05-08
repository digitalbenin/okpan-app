import path from 'path';
import os from 'os';
import fs from 'fs';
import fsPromises from 'fs/promises';
import yazl from 'yazl';
import { eq, inArray, and } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import { buildObjectSearchConditions, buildCounts, makeExportResult } from '../handlers/exportHandlers.js';
import { resolveLogicalAssetPath } from './assetPaths.js';

async function ensureDir(dirPath) { await fsPromises.mkdir(dirPath, { recursive: true }); }
async function writeJson(filePath, obj) { await ensureDir(path.dirname(filePath)); await fsPromises.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf-8'); }

// Helper to clean objects by removing timestamps and IDs
function cleanEntity(table, obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = { ...obj };
  delete cleaned.created_at;
  delete cleaned.updated_at;
  // Preserve `id` for top-level exported objects per request
  if (table !== 'objects') delete cleaned.id;
  // Remove status from all entities in JSON export
  if ('status' in cleaned) delete cleaned.status;
  return cleaned;
}

// Centralized static schema references (edit here if DB schema evolves)
const FOREIGN_KEY_MAP = {
  objects: ['institution_id', 'project_id'],
  objects_ontology_fields: ['object_id', 'field_id', 'datasources_id'],
  objects_research_fields: ['object_id', 'field_id', 'vocabulary_id'],
  objects_assets: ['object_id', 'asset_id'],
  assets_institutions: ['asset_id', 'institution_id'],
  assets: ['institution_id', 'project_id'],
  datasources: ['institution_id', 'import_id'],
  vocabularies: ['main_asset_id'],
  vocabularies_generic_assets: ['vocabulary_id', 'generic_asset_id'],
  institutions: ['project_id'],
  generic_assets: ['project_id'],
  languages: ['project_id'],
  objects_datasources: ['object_id', 'datasource_id', 'template_id']
};

const TEXT_FIELD_LABEL_MAP = {
  institutions: { name_id: 'name', description_id: 'description', country_id: 'country', location_id: 'location' },
  ontology_fields: { name_id: 'name', description_id: 'description', category_id: 'category' },
  datasources: { name_id: 'name', method_id: 'method', notes_id: 'notes' },
  research_fields: { name_id: 'name', description_id: 'description' },
  vocabularies: { option_id: 'option', description_id: 'description' }
};

const EXCLUDE_FIELDS_MAP = {
  ontology_fields: ['embeddings', 'onwebsite'],
  objects_ontology_fields: ['default_description'],
  research_fields: ['onwebsite', 'fields_config', 'type'],
  // keep aligned with CSV/SQL exporters
  assets: ['path', 'formats'],
  objects_assets: ['order']
};

// Helper derived maps
const TEXT_FIELD_MAP = Object.fromEntries(
  Object.entries(TEXT_FIELD_LABEL_MAP).map(([tbl, labels]) => [tbl, Object.keys(labels)])
);

// Helper to clean arrays of entities
function cleanEntities(table, entities) {
  return entities.map((e) => cleanEntity(table, e));
}

async function createZipFromFolder(folderPath, zipPath) {
  await ensureDir(path.dirname(zipPath));
  return new Promise(async (resolve, reject) => {
    try {
      const zipfile = new yazl.ZipFile();
      const out = fs.createWriteStream(zipPath);
      zipfile.outputStream.pipe(out).on('close', () => resolve(true));

      async function addDir(dir) {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await addDir(fullPath);
          } else if (entry.isFile()) {
            const relPath = path.relative(folderPath, fullPath).replace(/\\/g, '/');
            zipfile.addFile(fullPath, relPath);
          }
        }
      }

      await addDir(folderPath);
      zipfile.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function exportProjectJson(options, { db }) {
  const { filePath, filters = {}, includeAssets = false } = options || {};
  if (!filePath || !filePath.toLowerCase().endsWith('.zip')) throw new Error('filePath must be a .zip path for JSON export');
  if (!filters?.project_id) throw new Error('project_id is required in filters');

  // 1) Find matching object IDs using same filtering logic as SQL
  const conditions = buildObjectSearchConditions(filters);
  const idRows = await db.select({ id: dbSchema.objects.id }).from(dbSchema.objects).where(and(...conditions)).execute();
  const objectIds = idRows.map((r) => r.id);

  // 2) Preload all relation tables needed to expand graphs efficiently
  const [objects, oofs, orfs, oassets] = await Promise.all([
    db.select().from(dbSchema.objects).where(inArray(dbSchema.objects.id, objectIds)).execute(),
    db.select().from(dbSchema.objects_ontology_fields).where(inArray(dbSchema.objects_ontology_fields.object_id, objectIds)).execute(),
    db.select().from(dbSchema.objects_research_fields).where(inArray(dbSchema.objects_research_fields.object_id, objectIds)).execute(),
    db.select().from(dbSchema.objects_assets).where(inArray(dbSchema.objects_assets.object_id, objectIds)).execute(),
  ]);

  const assetIds = Array.from(new Set(oassets.map((r) => r.asset_id).filter(Boolean)));
  const [assets, assetsInstitutions] = await Promise.all([
    assetIds.length ? db.select().from(dbSchema.assets).where(inArray(dbSchema.assets.id, assetIds)).execute() : [],
    assetIds.length ? db.select().from(dbSchema.assets_institutions).where(inArray(dbSchema.assets_institutions.asset_id, assetIds)).execute() : [],
  ]);

  const institutionIds = Array.from(new Set([
    ...assets.map((a) => a.institution_id).filter(Boolean),
    ...assetsInstitutions.map((ai) => ai.institution_id).filter(Boolean),
  ]));
  const institutions = institutionIds.length ? await db.select().from(dbSchema.institutions).where(inArray(dbSchema.institutions.id, institutionIds)).execute() : [];

  const ontologyFieldIds = Array.from(new Set(oofs.map((r) => r.field_id).filter(Boolean)));
  const datasourceIds = Array.from(new Set(oofs.map((r) => r.datasources_id).filter(Boolean)));
  const [ontologyFields, datasources] = await Promise.all([
    ontologyFieldIds.length ? db.select().from(dbSchema.ontology_fields).where(inArray(dbSchema.ontology_fields.id, ontologyFieldIds)).execute() : [],
    datasourceIds.length ? db.select().from(dbSchema.datasources).where(inArray(dbSchema.datasources.id, datasourceIds)).execute() : [],
  ]);
  
  // Get objects_datasources to find templates used for each object-datasource pair
  const objectsDatasources = objectIds.length
    ? await db.select().from(dbSchema.objects_datasources).where(inArray(dbSchema.objects_datasources.object_id, objectIds)).execute()
    : [];
  const templateIds = Array.from(new Set(objectsDatasources.map((od) => od.template_id).filter(Boolean)));
  const templates = templateIds.length ? await db.select().from(dbSchema.templates).where(inArray(dbSchema.templates.id, templateIds)).execute() : [];

  const researchFieldIds = Array.from(new Set(orfs.map((r) => r.field_id).filter(Boolean)));
  const researchFields = researchFieldIds.length ? await db.select().from(dbSchema.research_fields).where(inArray(dbSchema.research_fields.id, researchFieldIds)).execute() : [];
  const vocabularyIds = Array.from(new Set(orfs.map((r) => r.vocabulary_id).filter(Boolean)));
  const [vocabularies, vga] = await Promise.all([
    vocabularyIds.length ? db.select().from(dbSchema.vocabularies).where(inArray(dbSchema.vocabularies.id, vocabularyIds)).execute() : [],
    vocabularyIds.length ? db.select().from(dbSchema.vocabularies_generic_assets).where(inArray(dbSchema.vocabularies_generic_assets.vocabulary_id, vocabularyIds)).execute() : [],
  ]);
  const genericAssetIds = Array.from(new Set([
    ...vga.map((r) => r.generic_asset_id).filter(Boolean),
    ...vocabularies.map((v) => v.main_asset_id).filter(Boolean),
  ]));
  const genericAssets = genericAssetIds.length ? await db.select().from(dbSchema.genericAssets).where(inArray(dbSchema.genericAssets.id, genericAssetIds)).execute() : [];

  // texts/translations/languages for human-readable fields
  const textSet = new Set();
  const pushText = (id) => { if (id) textSet.add(id); };
  const COLLECT_FROM = {
    institutions,
    ontology_fields: ontologyFields,
    datasources,
    research_fields: researchFields,
    vocabularies
  };
  Object.entries(TEXT_FIELD_LABEL_MAP).forEach(([tbl, labels]) => {
    const rows = COLLECT_FROM[tbl] || [];
    rows.forEach(r => {
      Object.keys(labels).forEach(idKey => pushText(r[idKey]));
    });
  });

  const textIds = Array.from(textSet);
  const [texts, languages] = await Promise.all([
    textIds.length ? db.select().from(dbSchema.texts).where(inArray(dbSchema.texts.id, textIds)).execute() : [],
    filters.project_id ? db.select().from(dbSchema.languages).where(eq(dbSchema.languages.project_id, filters.project_id)).execute() : [],
  ]);
  const languageIds = languages.map((l) => l.id);
  const translations = textIds.length && languageIds.length
    ? await db.select().from(dbSchema.translations).where(and(inArray(dbSchema.translations.text_id, textIds), inArray(dbSchema.translations.language_id, languageIds))).execute()
    : [];

  // Index by id for fast joins during expansion
  const idx = (rows, key = 'id') => Object.fromEntries(rows.map((r) => [r[key], r]));
  const by = (rows, key) => rows.reduce((m, r) => { const k = r[key]; if (k == null) return m; if (!m[k]) m[k] = []; m[k].push(r); return m; }, {});

  const iObjects = idx(objects);
  const byObjectOofs = by(oofs, 'object_id');
  const byObjectOrfs = by(orfs, 'object_id');
  const byObjectAssets = by(oassets, 'object_id');
  const iAssets = idx(assets);
  const byAssetInst = by(assetsInstitutions, 'asset_id');
  const iInstitutions = idx(institutions);
  const iFields = idx(ontologyFields);
  const iDatasources = idx(datasources);
  const iTemplates = idx(templates);
  const iObjectsDatasources = idx(objectsDatasources);
  const byObjectDs = by(objectsDatasources, 'object_id');
  const iResearchFields = idx(researchFields);
  const iVocabs = idx(vocabularies);
  const byVocabGA = by(vga, 'vocabulary_id');
  const iGenericAssets = idx(genericAssets);
  const iTexts = idx(texts);
  const byTextTrans = by(translations, 'text_id');

  // Helper to fetch full text bundle (original + translations)
  const textBundle = (id) => {
    if (!id) return null;
    const t = iTexts[id];
    if (!t) return null;
    const trans = byTextTrans[id] || [];
    return { ...t, translations: trans };
  };

  // Helper to convert text references to language-keyed objects (includes original content)
  const expandText = (textId) => {
    if (!textId) return null;
    const t = iTexts[textId];
    if (!t) return null;
    const map = {};
    const origLang = languages.find((l) => l.id === t.original_language_id);
    if (origLang && t.content) map[origLang.code] = t.content;
    const trans = byTextTrans[textId] || [];
    trans.forEach((tr) => {
      const lang = languages.find((l) => l.id === tr.language_id);
      if (lang && tr.content) map[lang.code] = tr.content;
    });
    return Object.keys(map).length ? map : null;
  };

  function sanitizeRow(table, row) {
    if (!row) return null;
    const base = cleanEntity(table, row);
    const rm = [
      ...(FOREIGN_KEY_MAP[table] || []),
      ...(Object.keys(TEXT_FIELD_LABEL_MAP[table] || {})),
      ...(EXCLUDE_FIELDS_MAP[table] || [])
    ];
    rm.forEach((k) => {
      if (k in base) delete base[k];
    });
    return base;
  }

  function expandEntity(table, row) {
    if (!row) return null;
    const base = sanitizeRow(table, row);
    const labels = TEXT_FIELD_LABEL_MAP[table] || {};
    for (const [idKey, outKey] of Object.entries(labels)) {
      base[outKey] = expandText(row[idKey]);
    }
    // Parse JSON fields for specific tables
    if (table === 'institutions' && base.links !== undefined) {
      const v = base.links;
      if (typeof v === 'string') {
        const s = v.trim();
        if (s === '' || s.toLowerCase() === 'null') {
          base.links = null;
        } else {
          try { base.links = JSON.parse(s); } catch { }
        }
      }
    }
    return base;
  }

  // Prepare output directories
  const outRoot = path.join(os.tmpdir(), `export_${filters.project_id}_${Date.now()}`);
  const dataDir = path.join(outRoot, 'data');
  await ensureDir(dataDir);

  // Aggregate all objects into a single array file
  const objectsOut = [];
  for (const obj of objects) {
    const oJson = sanitizeRow('objects', obj);

    // Expand institution reference
    if (obj.institution_id) {
      const inst = iInstitutions[obj.institution_id];
      if (inst) {
        oJson.institution = expandEntity('institutions', inst);
      }
    }

    // expand ontology fields grouped by datasource
    const myOofs = byObjectOofs[obj.id] || [];
    const byDs = myOofs.reduce((m, o) => { const k = o.datasources_id || 'null'; (m[k] ||= []).push(o); return m; }, {});
    
    // Get object-datasource records for this object to find templates
    const myOds = byObjectDs[obj.id] || [];
    const templateByDs = myOds.reduce((m, od) => { m[od.datasource_id] = od.template_id; return m; }, {});
    
    oJson.datasources = Object.entries(byDs).map(([dsId, items]) => {
      const ds = dsId !== 'null' ? iDatasources[dsId] : null;
      const templateId = templateByDs[dsId];
      const template = templateId ? iTemplates[templateId] : null;
      const dsOut = ds
        ? { ...expandEntity('datasources', ds), template: template ? sanitizeRow('templates', template) : null }
        : { template: null };
      dsOut.items = items.map((o) => {
        const field = iFields[o.field_id];
        return {
          ...sanitizeRow('objects_ontology_fields', o),
          field: field ? expandEntity('ontology_fields', field) : null
        };
      });
      return dsOut;
    });

    // expand research fields - separate free text from connections (vocabulary-based)
    const myOrfs = byObjectOrfs[obj.id] || [];
    
    // Free text research fields (non-vocabulary type)
    const freeTextOrfs = myOrfs.filter((r) => {
      const field = iResearchFields[r.field_id];
      return field && (field.type || '').toLowerCase() !== 'vocabulary';
    });
    oJson.research_fields = freeTextOrfs.map((r) => {
      const field = iResearchFields[r.field_id];
      return {
        ...sanitizeRow('objects_research_fields', r),
        field: field ? expandEntity('research_fields', field) : null,
        value: r.value ?? null
      };
    });

    // Connections (vocabulary-based research fields)
    const connectionOrfs = myOrfs.filter((r) => {
      const field = iResearchFields[r.field_id];
      return field && (field.type || '').toLowerCase() === 'vocabulary' && r.vocabulary_id;
    });
    oJson.connections = connectionOrfs.map((r) => {
      const field = iResearchFields[r.field_id];
      const vocab = iVocabs[r.vocabulary_id];
      const valueOut = vocab ? expandText(vocab.option_id) : null;

      return {
        ...sanitizeRow('objects_research_fields', r),
        connection_type: field ? expandEntity('research_fields', field) : null,
        option: vocab ? {
          ...sanitizeRow('vocabularies', vocab),
          label: valueOut,
          description: expandText(vocab.description_id),
          main_asset: vocab.main_asset_id ? (() => {
            const ga = iGenericAssets[vocab.main_asset_id];
            return ga ? {
              filename: ga.filename || null,
              type: ga.type || null,
              properties: ga.properties ?? null
            } : null;
          })() : null,
          generic_assets: (byVocabGA[vocab.id] || []).map((ga) => sanitizeRow('generic_assets', iGenericAssets[ga.generic_asset_id])).filter(Boolean)
        } : null
      };
    });

    // expand assets
    const myOassets = byObjectAssets[obj.id] || [];
    const assetItems = myOassets.map((oa) => {
      const a = iAssets[oa.asset_id];
      return a ? sanitizeRow('assets', a) : null;
    }).filter(Boolean);

    // Do NOT include research-field main assets in top-level assets (per request)
    // Only object-linked assets are exported at the top level, still deduped by filename
    const merged = [];
    const seen = new Set();
    for (const item of assetItems) {
      const key = item && item.filename ? item.filename : JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
    oJson.assets = merged;

    // Exclude catalog entirely per request

    objectsOut.push(oJson);
  }

  // Write a single consolidated objects file
  const outPath = path.join(dataDir, 'objects.json');
  await writeJson(outPath, objectsOut);

  // Optionally copy binary assets referenced by these objects next to JSON files
  if (includeAssets) {
    const assetsDir = path.join(outRoot, 'assets');
    await ensureDir(assetsDir);
    for (const a of assets) {
      if (!a?.path) continue;
      try {
        const sourcePath = resolveLogicalAssetPath(a.path);
        if (!sourcePath) continue;
        const base = a.filename || path.basename(sourcePath || a.path || a.id);
        const dest = path.join(assetsDir, base);
        await fsPromises.copyFile(sourcePath, dest);
      } catch { }
    }
    for (const ga of genericAssets) {
      if (!ga?.path) continue;
      try {
        const sourcePath = resolveLogicalAssetPath(ga.path);
        if (!sourcePath) continue;
        const base = ga.filename || path.basename(sourcePath || ga.path || ga.id);
        const dest = path.join(assetsDir, base);
        await fsPromises.copyFile(sourcePath, dest);
      } catch { }
    }
  }

  // Align behavior with SQL export when no objects matched: add a README.txt
  if ((objects?.length || 0) === 0) {
    try { await fsPromises.writeFile(path.join(outRoot, 'README.txt'), 'No objects matched the filters.'); } catch { }
  }

  // Build counts from the loaded datasets to unify response with SQL export
  const counts = buildCounts({
    objects,
    assets,
    institutions,
  });

  await createZipFromFolder(outRoot, filePath);
  try { await fsPromises.rm(outRoot, { recursive: true, force: true }); } catch { }

  return makeExportResult({ filePath, zipped: true, counts, fallbackMode: 'json' });
}