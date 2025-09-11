import { eq, inArray, and } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import path from 'path';
import os from 'os';
import fsPromises from 'fs/promises';
import { execFile } from 'child_process';
import { buildObjectSearchConditions } from './objectSearchConditions.js';
import { buildCounts, makeExportResult } from './exportResult.js';

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
    const args = ['-NoProfile', '-Command', `Compress-Archive -Path "${folderPath}/*" -DestinationPath "${zipPath}" -Force`];
    execFile('powershell', args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`ZIP failed: ${stderr || error.message}`));
      resolve(true);
    });
  });
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
      try { await fsPromises.rm(tmpBase, { recursive: true, force: true }); } catch { }
      return makeExportResult({ filePath, zipped: true, counts: buildCounts(), fallbackMode: 'sql' });
    } else {
      await fsPromises.writeFile(filePath, '-- No objects matched the filters.\n', 'utf-8');
      return makeExportResult({ filePath, zipped: false, counts: buildCounts(), fallbackMode: 'sql' });
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
  const orfs = await db.select().from(dbSchema.objects_research_fields).where(inArray(dbSchema.objects_research_fields.object_id, objectIds)).execute();
  const researchFieldIds = Array.from(new Set(orfs.map((r) => r.field_id).filter(Boolean)));
  const researchFields = researchFieldIds.length ? await db.select().from(dbSchema.research_fields).where(inArray(dbSchema.research_fields.id, researchFieldIds)).execute() : [];
  const vocabularyIds = Array.from(new Set(orfs.map((r) => r.vocabulary_id).filter(Boolean)));
  const vocabularies = vocabularyIds.length ? await db.select().from(dbSchema.vocabularies).where(inArray(dbSchema.vocabularies.id, vocabularyIds)).execute() : [];
  const vga = vocabularyIds.length ? await db.select().from(dbSchema.vocabularies_generic_assets).where(inArray(dbSchema.vocabularies_generic_assets.vocabulary_id, vocabularyIds)).execute() : [];
  const genericAssetIds = Array.from(new Set([
    ...vga.map((r) => r.generic_asset_id).filter(Boolean),
    ...vocabularies.map((v) => v.main_asset_id).filter(Boolean),
  ]));
  const genericAssets = genericAssetIds.length ? await db.select().from(dbSchema.genericAssets).where(inArray(dbSchema.genericAssets.id, genericAssetIds)).execute() : [];

  // 3) Prepare SQL content
  const ddl = generateSchemaDDL();
  const inserts = [
    generateInsertStatements('objects', objects),
    generateInsertStatements('objects_assets', objectsAssets),
    generateInsertStatements('assets', assets),
    generateInsertStatements('objects_ontology_fields', objectsOntologyFields),
    generateInsertStatements('ontology_fields', ontologyFields),
    generateInsertStatements('datasources', datasources),
    generateInsertStatements('templates', templates),
    generateInsertStatements('objects_research_fields', orfs),
    generateInsertStatements('research_fields', researchFields),
    generateInsertStatements('vocabularies', vocabularies),
    generateInsertStatements('vocabularies_generic_assets', vga),
    generateInsertStatements('generic_assets', genericAssets),
  ].join('\n');

  const sqlContent = ddl + inserts;

  const counts = buildCounts({
    objects,
    assets,
    ontologyFields,
    datasources,
    templates,
    researchFields,
    vocabularies,
    vga,
    genericAssets,
  });

  if (!wantZip) {
    await fsPromises.writeFile(filePath, sqlContent, 'utf-8');
    return makeExportResult({ filePath, zipped: false, counts, fallbackMode: 'sql' });
  }

  // 4) If want zip, write SQL and optionally copy assets/generic assets
  const tmpBase = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'export-sql-'));
  const dataDir = path.join(tmpBase, 'data');
  await ensureDir(dataDir);
  const sqlFile = path.join(dataDir, 'export.sql');
  await fsPromises.writeFile(sqlFile, sqlContent, 'utf-8');

  if (includeAssets) {
    const assetsDir = path.join(tmpBase, 'assets');
    await ensureDir(assetsDir);
    for (const a of genericAssets) {
      if (!a?.path) continue;
      const ok = await copyFileIfExists(a.path, path.join(assetsDir, a.filename || String(a.id)));
    }
    for (const a of assets) {
      if (!a?.path) continue;
      const ok = await copyFileIfExists(a.path, path.join(assetsDir, a.filename || String(a.id)));
    }
  }

  await createZipFromFolder(tmpBase, filePath);
  try { await fsPromises.rm(tmpBase, { recursive: true, force: true }); } catch { }

  return makeExportResult({ filePath, zipped: true, counts, fallbackMode: 'sql' });
}