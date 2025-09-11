import { sql, eq, inArray, and, or } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import path from 'path';
import os from 'os';
import fsPromises from 'fs/promises';
import { execFile } from 'child_process';

// Utility: escape single quotes for SQL
const sqlEscape = (val) => String(val).replace(/'/g, "''");

const formatValue = (val) => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') return `'${sqlEscape(JSON.stringify(val))}'`;
  return `'${sqlEscape(val)}'`;
};

const generateInsertStatements = (tableName, rows) => {
  if (!rows || rows.length === 0) return '';
  // Use union of columns across all rows to avoid shape mismatches
  const allCols = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  const colList = allCols.map((c) => `"${c}"`).join(', ');
  return rows
    .map((row) => {
      const values = allCols.map((c) => formatValue(row[c]));
      return `INSERT OR REPLACE INTO ${tableName} (${colList}) VALUES (${values.join(', ')});`;
    })
    .join('\n') + '\n';
};

const generateSchemaDDL = () => {
  const ddls = [];
  const push = (table, createSql) => {
    ddls.push(`DROP TABLE IF EXISTS ${table};`);
    ddls.push(createSql.trim().replace(/;?$/, ';'));
  };
  push('project', `CREATE TABLE project (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title_id TEXT REFERENCES texts(id),
    description_id TEXT REFERENCES texts(id),
    exports TEXT
  )`);
  push('languages', `CREATE TABLE languages (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id TEXT NOT NULL REFERENCES project(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
  )`);
  push('texts', `CREATE TABLE texts (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content TEXT NOT NULL,
    context TEXT NOT NULL,
    original_language_id TEXT NOT NULL REFERENCES languages(id)
  )`);
  push('translations', `CREATE TABLE translations (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    text_id TEXT NOT NULL REFERENCES texts(id),
    language_id TEXT NOT NULL REFERENCES languages(id),
    content TEXT NOT NULL
  )`);
  push('institutions', `CREATE TABLE institutions (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name_id TEXT NOT NULL REFERENCES texts(id),
    description_id TEXT REFERENCES texts(id),
    country_id TEXT REFERENCES texts(id),
    location_id TEXT REFERENCES texts(id),
    lon INTEGER,
    lat INTEGER,
    website TEXT,
    links TEXT,
    project_id TEXT REFERENCES project(id),
    status TEXT,
    logo TEXT
  )`);
  push('assets', `CREATE TABLE assets (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filename TEXT,
    path TEXT,
    type TEXT,
    formats TEXT,
    properties TEXT,
    institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES project(id)
  )`);
  push('generic_assets', `CREATE TABLE generic_assets (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filename TEXT,
    path TEXT,
    type TEXT,
    formats TEXT,
    properties TEXT,
    project_id TEXT REFERENCES project(id)
  )`);
  push('research_fields', `CREATE TABLE research_fields (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name_id TEXT REFERENCES texts(id),
    type TEXT,
    description_id TEXT REFERENCES texts(id),
    project_id TEXT REFERENCES project(id),
    private INTEGER NOT NULL DEFAULT 0,
    onwebsite INTEGER NOT NULL DEFAULT 1
  )`);
  push('vocabularies', `CREATE TABLE vocabularies (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    option_id TEXT REFERENCES texts(id),
    description_id TEXT REFERENCES texts(id),
    main_asset_id TEXT REFERENCES generic_assets(id),
    field_id TEXT REFERENCES research_fields(id) ON DELETE CASCADE
  )`);
  push('vocabularies_generic_assets', `CREATE TABLE vocabularies_generic_assets (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vocabulary_id TEXT REFERENCES vocabularies(id) ON DELETE CASCADE,
    generic_asset_id TEXT REFERENCES generic_assets(id) ON DELETE CASCADE,
    "order" INTEGER
  )`);
  push('ontology_fields', `CREATE TABLE ontology_fields (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name_id TEXT REFERENCES texts(id),
    description_id TEXT REFERENCES texts(id),
    category_id TEXT REFERENCES texts(id),
    embeddings TEXT,
    onwebsite INTEGER DEFAULT 1
  )`);
  push('templates', `CREATE TABLE templates (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mapping TEXT,
    project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
    asset_map_rule TEXT
  )`);
  push('datasources', `CREATE TABLE datasources (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name_id TEXT REFERENCES texts(id),
    institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
    template_id TEXT REFERENCES templates(id),
    language TEXT,
    copyright TEXT,
    method_id TEXT REFERENCES texts(id),
    contact TEXT,
    notes_id TEXT REFERENCES texts(id),
    date INTEGER
  )`);
  push('objects', `CREATE TABLE objects (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT,
    institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES project(id)
  )`);
  push('objects_research_fields', `CREATE TABLE objects_research_fields (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    object_id TEXT REFERENCES objects(id) ON DELETE CASCADE,
    field_id TEXT REFERENCES research_fields(id) ON DELETE CASCADE,
    vocabulary_id TEXT REFERENCES vocabularies(id),
    value TEXT
  )`);
  push('objects_ontology_fields', `CREATE TABLE objects_ontology_fields (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    label TEXT,
    value TEXT,
    object_id TEXT REFERENCES objects(id) ON DELETE CASCADE,
    field_id TEXT REFERENCES ontology_fields(id),
    datasources_id TEXT REFERENCES datasources(id),
    "primary" INTEGER,
    default_description INTEGER
  )`);
  push('objects_assets', `CREATE TABLE objects_assets (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    object_id TEXT REFERENCES objects(id) ON DELETE CASCADE,
    "order" INTEGER
  )`);
  push('assets_institutions', `CREATE TABLE assets_institutions (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
    rule TEXT
  )`);
  return ddls.join('\n') + '\n';
};

async function ensureDir(dirPath) { await fsPromises.mkdir(dirPath, { recursive: true }); }
async function copyFileIfExists(src, dest) { try { await ensureDir(path.dirname(dest)); await fsPromises.copyFile(src, dest); return true; } catch { return false; } }
async function createZipFromFolder(folderPath, zipPath) {
  const isWin = process.platform === 'win32';
  if (!isWin) throw new Error('ZIP export currently supported only on Windows environment');
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile','-Command',`Compress-Archive -Path "${folderPath}/*" -DestinationPath "${zipPath}" -Force`];
    execFile('powershell', args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`ZIP failed: ${stderr || error.message}`));
      resolve(true);
    });
  });
}

// Build search conditions like objectSearch
function buildObjectSearchConditions(args) {
  const { project_id, institutionIds, status, ontologyQuery, ontologyFieldIds, researchFieldFilters } = args || {};
  const conditions = [eq(dbSchema.objects.project_id, project_id)];
  if (institutionIds && institutionIds.length > 0) conditions.push(inArray(dbSchema.objects.institution_id, institutionIds));
  if (status) conditions.push(eq(dbSchema.objects.status, status));
  if (ontologyQuery && ontologyQuery.trim()) {
    const q = `%${ontologyQuery.trim().toLowerCase()}%`;
    if (ontologyFieldIds && ontologyFieldIds.length > 0) {
      const existsPerField = ontologyFieldIds.map((fid) => sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_ontology_fields} oof WHERE oof.object_id = ${dbSchema.objects.id} AND oof.field_id = ${fid} AND LOWER(oof.value) LIKE ${q})`);
      conditions.push(existsPerField.length === 1 ? existsPerField[0] : or(...existsPerField));
    } else {
      conditions.push(sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_ontology_fields} oof WHERE oof.object_id = ${dbSchema.objects.id} AND LOWER(oof.value) LIKE ${q})`);
    }
  }
  const rfFilters = Array.isArray(researchFieldFilters)
    ? researchFieldFilters.map((f) => { try { return typeof f === 'string' ? JSON.parse(f) : f; } catch { return f; } })
    : [];
  if (rfFilters.length > 0) {
    const rfConds = [];
    for (const filter of rfFilters) {
      const fieldConds = [];
      if (filter?.query && String(filter.query).trim()) {
        const rq = `%${String(filter.query).trim().toLowerCase()}%`;
        fieldConds.push(sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_research_fields} orf WHERE orf.object_id = ${dbSchema.objects.id} AND orf.field_id = ${filter.fieldId} AND LOWER(orf.value) LIKE ${rq})`);
      }
      if (filter?.vocabularyIds && filter.vocabularyIds.length > 0) {
        const vocOr = filter.vocabularyIds.map((vid) => sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_research_fields} orf WHERE orf.object_id = ${dbSchema.objects.id} AND orf.field_id = ${filter.fieldId} AND orf.vocabulary_id = ${vid})`);
        fieldConds.push(vocOr.length === 1 ? vocOr[0] : or(...vocOr));
      }
      if (fieldConds.length > 0) rfConds.push(fieldConds.length === 1 ? fieldConds[0] : and(...fieldConds));
    }
    if (rfConds.length > 0) conditions.push(rfConds.length === 1 ? rfConds[0] : and(...rfConds));
  }
  return conditions;
}

export async function exportProjectSql(options, { db }) {
  const { filePath, filters = {}, includeAssets = false, mode = 'sql' } = options || {};
  if (!filters?.project_id) throw new Error('project_id is required in filters');
  const wantZip = mode === 'zip' || (typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip'));

  // 1) Collect matching object IDs
  const conditions = buildObjectSearchConditions(filters);
  const idRows = await db.select({ id: dbSchema.objects.id }).from(dbSchema.objects).where(and(...conditions)).execute();
  const objectIds = idRows.map((r) => r.id);
  if (objectIds.length === 0) {
    if (wantZip) {
      const tmpBase = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'export-'));
      await fsPromises.writeFile(path.join(tmpBase, 'README.txt'), 'No objects matched the filters.');
      await createZipFromFolder(tmpBase, filePath);
      try { await fsPromises.rm(tmpBase, { recursive: true, force: true }); } catch {}
      return { filePath, mode: 'zip', counts: { objects: 0 } };
    } else {
      await fsPromises.writeFile(filePath, '-- No objects matched the filters.\n', 'utf-8');
      return { filePath, mode: 'sql', counts: { objects: 0 } };
    }
  }

  // 2) Collect related rows (same as original handler)
  const objects = await db.select().from(dbSchema.objects).where(inArray(dbSchema.objects.id, objectIds)).execute();
  const objectsAssets = await db.select().from(dbSchema.objects_assets).where(inArray(dbSchema.objects_assets.object_id, objectIds)).execute();
  const assetIds = Array.from(new Set(objectsAssets.map((r) => r.asset_id).filter(Boolean)));
  const assets = assetIds.length ? await db.select().from(dbSchema.assets).where(inArray(dbSchema.assets.id, assetIds)).execute() : [];
  const objectsOntologyFields = await db.select().from(dbSchema.objects_ontology_fields).where(inArray(dbSchema.objects_ontology_fields.object_id, objectIds)).execute();
  const ontologyFieldIds = Array.from(new Set(objectsOntologyFields.map((r) => r.field_id).filter(Boolean)));
  const datasourceIds = Array.from(new Set(objectsOntologyFields.map((r) => r.datasources_id).filter(Boolean)));
  const ontologyFields = ontologyFieldIds.length ? await db.select().from(dbSchema.ontology_fields).where(inArray(dbSchema.ontology_fields.id, ontologyFieldIds)).execute() : [];
  const datasources = datasourceIds.length ? await db.select().from(dbSchema.datasources).where(inArray(dbSchema.datasources.id, datasourceIds)).execute() : [];
  const templateIds = Array.from(new Set(datasources.map((d) => d.template_id).filter(Boolean)));
  const templates = templateIds.length ? await db.select().from(dbSchema.templates).where(inArray(dbSchema.templates.id, templateIds)).execute() : [];
  const rfIds = Array.from(new Set(objectsOntologyFields.map((_) => null))); // placeholder to keep structure
  const orfs = await db.select().from(dbSchema.objects_research_fields).where(inArray(dbSchema.objects_research_fields.object_id, objectIds)).execute();
  const researchFieldIds = Array.from(new Set(orfs.map((r) => r.field_id).filter(Boolean)));
  const researchFields = researchFieldIds.length ? await db.select().from(dbSchema.research_fields).where(inArray(dbSchema.research_fields.id, researchFieldIds)).execute() : [];
  const vocabularyIds = Array.from(new Set(orfs.map((r) => r.vocabulary_id).filter(Boolean)));
  const vocabularies = vocabularyIds.length ? await db.select().from(dbSchema.vocabularies).where(inArray(dbSchema.vocabularies.id, vocabularyIds)).execute() : [];
  const vgRows = vocabularyIds.length ? await db.select().from(dbSchema.vocabularies_generic_assets).where(inArray(dbSchema.vocabularies_generic_assets.vocabulary_id, vocabularyIds)).execute() : [];
  const genericAssetIds = Array.from(new Set([
    ...vgRows.map((r) => r.generic_asset_id).filter(Boolean),
    ...vocabularies.map((v) => v.main_asset_id).filter(Boolean)
  ]));
  const genericAssets = genericAssetIds.length ? await db.select().from(dbSchema.genericAssets).where(inArray(dbSchema.genericAssets.id, genericAssetIds)).execute() : [];
  const assetsInstitutions = assetIds.length ? await db.select().from(dbSchema.assets_institutions).where(inArray(dbSchema.assets_institutions.asset_id, assetIds)).execute() : [];
  const institutionIds = Array.from(new Set([
    ...assets.map((a) => a.institution_id).filter(Boolean),
    ...assetsInstitutions.map((ai) => ai.institution_id).filter(Boolean)
  ]));
  const institutions = institutionIds.length ? await db.select().from(dbSchema.institutions).where(inArray(dbSchema.institutions.id, institutionIds)).execute() : [];
  const projectRow = await db.select().from(dbSchema.project).where(eq(dbSchema.project.id, filters.project_id)).execute();

  const textIdSet = new Set();
  const pushText = (id) => { if (id) textIdSet.add(id); };
  const project = projectRow[0]; if (project) { pushText(project.title_id); pushText(project.description_id); }
  institutions.forEach((inst) => { pushText(inst.name_id); pushText(inst.description_id); pushText(inst.country_id); pushText(inst.location_id); });
  const rfSetTexts = (arr) => arr.forEach((rf) => { pushText(rf.name_id); pushText(rf.description_id); });
  rfSetTexts(researchFields);
  ontologyFields.forEach((f) => { pushText(f.name_id); pushText(f.description_id); pushText(f.category_id); });
  datasources.forEach((d) => { pushText(d.name_id); pushText(d.method_id); pushText(d.notes_id); });
  vocabularies.forEach((v) => { pushText(v.option_id); pushText(v.description_id); });

  const textIds = Array.from(textIdSet);
  const texts = textIds.length ? await db.select().from(dbSchema.texts).where(inArray(dbSchema.texts.id, textIds)).execute() : [];
  const languages = await db.select().from(dbSchema.languages).where(eq(dbSchema.languages.project_id, filters.project_id)).execute();
  const languageIds = languages.map((l) => l.id);
  const translations = textIds.length && languageIds.length ? await db.select().from(dbSchema.translations).where(and(inArray(dbSchema.translations.text_id, textIds), inArray(dbSchema.translations.language_id, languageIds))).execute() : [];

  // 3) Generate SQL
  let sqlOut = '';
  sqlOut += 'PRAGMA foreign_keys=OFF;\n';
  sqlOut += 'BEGIN TRANSACTION;\n\n';
  sqlOut += '-- Schema (drop and create)\n';
  sqlOut += generateSchemaDDL();
  sqlOut += '\n-- Data\n\n';
  sqlOut += generateInsertStatements('languages', languages);
  sqlOut += generateInsertStatements('texts', texts);
  sqlOut += generateInsertStatements('translations', translations);
  sqlOut += generateInsertStatements('project', projectRow);
  sqlOut += generateInsertStatements('institutions', institutions);
  sqlOut += generateInsertStatements('ontology_fields', ontologyFields);
  sqlOut += generateInsertStatements('research_fields', researchFields);
  sqlOut += generateInsertStatements('generic_assets', genericAssets);
  sqlOut += generateInsertStatements('vocabularies', vocabularies);
  sqlOut += generateInsertStatements('vocabularies_generic_assets', vgRows);
  sqlOut += generateInsertStatements('templates', templates);
  sqlOut += generateInsertStatements('datasources', datasources);
  sqlOut += generateInsertStatements('assets', assets);
  sqlOut += generateInsertStatements('objects', objects);
  sqlOut += generateInsertStatements('objects_research_fields', orfs);
  sqlOut += generateInsertStatements('objects_ontology_fields', objectsOntologyFields);
  sqlOut += generateInsertStatements('objects_assets', objectsAssets);
  sqlOut += generateInsertStatements('assets_institutions', assetsInstitutions);
  sqlOut += '\nCOMMIT;\nPRAGMA foreign_keys=ON;\n';

  if (!wantZip) {
    await fsPromises.writeFile(filePath, sqlOut, 'utf-8');
    return { filePath, mode: 'sql', counts: { objects: objects.length } };
  }

  const tmpBase = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'export-'));
  const sqlPath = path.join(tmpBase, 'export.sql');
  await fsPromises.writeFile(sqlPath, sqlOut, 'utf-8');

  if (includeAssets) {
    const assetsDir = path.join(tmpBase, 'assets');
    await ensureDir(assetsDir);
    for (const a of assets) {
      if (!a?.path) continue;
      const base = path.basename(a.path || a.filename || a.id);
      const dest = path.join(assetsDir, `${a.id}_${base}`);
      await copyFileIfExists(a.path, dest);
    }
    const genDir = path.join(tmpBase, 'generic_assets');
    await ensureDir(genDir);
    for (const ga of genericAssets) {
      if (!ga?.path) continue;
      const base = path.basename(ga.path || ga.filename || ga.id);
      const dest = path.join(genDir, `${ga.id}_${base}`);
      await copyFileIfExists(ga.path, dest);
    }
  }

  await createZipFromFolder(tmpBase, filePath);
  try { await fsPromises.rm(tmpBase, { recursive: true, force: true }); } catch {}

  return {
    filePath,
    mode: 'zip',
    includeAssets,
    counts: {
      objects: objects.length,
      assets: assets.length,
      institutions: institutions.length,
      ontologyFields: ontologyFields.length,
      datasources: datasources.length,
      researchFields: researchFields.length,
      vocabularies: vocabularies.length,
    }
  };
}