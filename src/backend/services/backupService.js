/**
 * Backup service for creating, inspecting, and restoring project `.dctx`
 * archives.
 *
 * @namespace backend.services.backupService
 * @memberof backend.services
 */
import path from 'path';
import os from 'os';
import fs from 'fs';
import fsPromises from 'fs/promises';
import yazl from 'yazl';
import yauzl from 'yauzl';
import { eq, inArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import { copyFileIfExists, ensureDir, readJsonFile, removePathQuietly, removePathRobust, writeJsonFile } from '../utils/fsUtils.js';
import {
  normalizeProjectAssetRow,
  normalizeProjectAssetRows,
  resolveProjectAssetPath,
} from '../utils/assetPaths.js';

const sqlEscape = (val) => String(val).replace(/'/g, "''");

const convertProjectReplaceToUpsert = (statement) => {
  const match = statement.match(/^INSERT OR REPLACE INTO\s+project\s*\(([^)]+)\)\s*VALUES\s*\((.*)\)$/i);
  if (!match) {
    return statement;
  }

  const rawColumns = match[1].split(',').map((column) => column.trim());
  const rawValues = match[2].trim();
  const updateColumns = rawColumns.filter((column) => column.replace(/^"|"$/g, '') !== 'id');

  if (updateColumns.length === 0) {
    return statement.replace(/^INSERT OR REPLACE/i, 'INSERT');
  }

  const updateSet = updateColumns
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');

  return `INSERT INTO project (${match[1]}) VALUES (${rawValues}) ON CONFLICT("id") DO UPDATE SET ${updateSet}`;
};

const splitSqlStatements = (sqlContent) => {
  const statements = [];
  let current = '';
  let inSingleQuote = false;

  for (let index = 0; index < sqlContent.length; index += 1) {
    const char = sqlContent[index];
    const nextChar = sqlContent[index + 1];

    current += char;

    if (char === "'") {
      if (inSingleQuote && nextChar === "'") {
        current += nextChar;
        index += 1;
        continue;
      }

      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === ';' && !inSingleQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
    }
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
};

const formatValue = (val) => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  
  // Handle Date objects - convert to Unix timestamp in milliseconds
  if (val instanceof Date) {
    return String(val.getTime());
  }
  
  // Handle other objects/arrays
  if (typeof val === 'object') {
    return `'${sqlEscape(JSON.stringify(val))}'`;
  }
  
  // Handle strings
  if (typeof val === 'string') {
    return `'${sqlEscape(val)}'`;
  }
  
  return `'${sqlEscape(String(val))}'`;
};

async function normalizeRestoredAssetTableRows(table, projectId, { db }) {
  const assetRows = await db.select().from(table)
    .where(eq(table.project_id, projectId))
    .execute();

  for (const assetRow of assetRows) {
    const normalizedAssetRow = normalizeProjectAssetRow(assetRow, projectId);
    await db.update(table)
      .set({
        path: normalizedAssetRow.path,
        formats: normalizedAssetRow.formats,
      })
      .where(eq(table.id, assetRow.id))
      .execute();
  }
}

async function normalizeRestoredAssetRows(projectId, { db }) {
  await normalizeRestoredAssetTableRows(dbSchema.assets, projectId, { db });
  await normalizeRestoredAssetTableRows(dbSchema.genericAssets, projectId, { db });
}

const generateInsertStatements = (tableName, rows) => {
  if (!rows || rows.length === 0) return '';
  const allCols = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  const colList = allCols.map((c) => `"${c}"`).join(', ');
  return rows
    .map((row, rowIndex) => {
      // Ensure created_at and updated_at have values
      const processedRow = { ...row };
      const now = Date.now();

      if (allCols.includes('created_at') && (processedRow.created_at === null || processedRow.created_at === undefined || processedRow.created_at === '')) {
        console.warn(`[BACKUP] Table "${tableName}" row ${rowIndex} (id: ${row.id}): created_at is NULL, replacing with current timestamp`);
        processedRow.created_at = now;
      }
      if (allCols.includes('updated_at') && (processedRow.updated_at === null || processedRow.updated_at === undefined || processedRow.updated_at === '')) {
        console.warn(`[BACKUP] Table "${tableName}" row ${rowIndex} (id: ${row.id}): updated_at is NULL, replacing with current timestamp`);
        processedRow.updated_at = now;
      }
      
      const values = allCols.map((c) => formatValue(processedRow[c]));
      return `INSERT OR REPLACE INTO ${tableName} (${colList}) VALUES (${values.join(', ')});`;
    })
    .join('\n') + '\n';
};

const generateSchemaDDL = () => {
  const ddls = [];
  const push = (table, createSql) => {
    ddls.push(createSql.trim().replace(/;?$/, ';'));
  };

  push('project', `CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title_id TEXT REFERENCES texts(id),
    description_id TEXT REFERENCES texts(id),
    exports TEXT,
    password TEXT
  )`);

  push('languages', `CREATE TABLE IF NOT EXISTS languages (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id TEXT NOT NULL REFERENCES project(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
  )`);

  push('texts', `CREATE TABLE IF NOT EXISTS texts (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content TEXT NOT NULL,
    context TEXT NOT NULL,
    original_language_id TEXT NOT NULL REFERENCES languages(id)
  )`);

  push('translations', `CREATE TABLE IF NOT EXISTS translations (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    text_id TEXT NOT NULL REFERENCES texts(id),
    language_id TEXT NOT NULL REFERENCES languages(id),
    content TEXT NOT NULL
  )`);

  push('institutions', `CREATE TABLE IF NOT EXISTS institutions (
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

  push('assets', `CREATE TABLE IF NOT EXISTS assets (
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

  push('generic_assets', `CREATE TABLE IF NOT EXISTS generic_assets (
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

  push('research_fields', `CREATE TABLE IF NOT EXISTS research_fields (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name_id TEXT REFERENCES texts(id),
    type TEXT,
    description_id TEXT REFERENCES texts(id),
    project_id TEXT REFERENCES project(id),
    private INTEGER NOT NULL DEFAULT 0,
    onwebsite INTEGER NOT NULL DEFAULT 1,
    fields_config TEXT
  )`);

  push('vocabularies', `CREATE TABLE IF NOT EXISTS vocabularies (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    option_id TEXT REFERENCES texts(id),
    description_id TEXT REFERENCES texts(id),
    main_asset_id TEXT REFERENCES generic_assets(id),
    external_link TEXT,
    field_id TEXT REFERENCES research_fields(id) ON DELETE CASCADE
  )`);

  push('vocabularies_generic_assets', `CREATE TABLE IF NOT EXISTS vocabularies_generic_assets (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vocabulary_id TEXT REFERENCES vocabularies(id) ON DELETE CASCADE,
    generic_asset_id TEXT REFERENCES generic_assets(id) ON DELETE CASCADE,
    "order" INTEGER
  )`);

  push('ontology_fields', `CREATE TABLE IF NOT EXISTS ontology_fields (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name_id TEXT REFERENCES texts(id),
    description_id TEXT REFERENCES texts(id),
    category_id TEXT REFERENCES texts(id),
    embeddings TEXT,
    onwebsite INTEGER DEFAULT 1,
    project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE
  )`);

  push('templates', `CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      name TEXT,
    mapping TEXT,
    project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
    institution_id TEXT REFERENCES institutions(id) ON DELETE SET NULL,
    asset_map_rule TEXT
  )`);

  push('datasources', `CREATE TABLE IF NOT EXISTS datasources (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name_id TEXT REFERENCES texts(id),
    institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
    import_id TEXT REFERENCES imports(id) ON DELETE SET NULL,
    source TEXT,
    language TEXT,
    copyright TEXT,
    method_id TEXT REFERENCES texts(id),
    contact TEXT,
    notes_id TEXT REFERENCES texts(id),
    date INTEGER
  )`);

  push('objects', `CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT,
    name TEXT,
    institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES project(id)
  )`);

  push('objects_research_fields', `CREATE TABLE IF NOT EXISTS objects_research_fields (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    object_id TEXT REFERENCES objects(id) ON DELETE CASCADE,
    field_id TEXT REFERENCES research_fields(id) ON DELETE CASCADE,
    vocabulary_id TEXT REFERENCES vocabularies(id) ON DELETE CASCADE,
    value TEXT
  )`);

  push('objects_ontology_fields', `CREATE TABLE IF NOT EXISTS objects_ontology_fields (
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

  push('objects_assets', `CREATE TABLE IF NOT EXISTS objects_assets (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    object_id TEXT REFERENCES objects(id) ON DELETE CASCADE,
    "order" INTEGER
  )`);

  push('assets_institutions', `CREATE TABLE IF NOT EXISTS assets_institutions (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
    rule TEXT
  )`);

  push('settings', `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    password TEXT,
    sync_url TEXT,
    sig_server TEXT,
    project_id TEXT REFERENCES project(id)
  )`);

  push('object_display_fields', `CREATE TABLE IF NOT EXISTS object_display_fields (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    ontology_field_id TEXT REFERENCES ontology_fields(id) ON DELETE CASCADE,
    research_field_id TEXT REFERENCES research_fields(id) ON DELETE CASCADE,
    property_name TEXT
  )`);

  push('website_settings', `CREATE TABLE IF NOT EXISTS website_settings (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title_id TEXT REFERENCES texts(id),
    short_description_id TEXT REFERENCES texts(id),
    about_id TEXT REFERENCES texts(id),
    authors TEXT,
    logo_id TEXT REFERENCES generic_assets(id),
    subfolder_path TEXT,
    show_unmapped INTEGER NOT NULL DEFAULT 0,
    project_id TEXT REFERENCES project(id)
  )`);

  push('imports', `CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filename TEXT,
    data TEXT
  )`);

  push('objects_datasources', `CREATE TABLE IF NOT EXISTS objects_datasources (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    object_id TEXT REFERENCES objects(id) ON DELETE CASCADE,
    datasource_id TEXT REFERENCES datasources(id) ON DELETE CASCADE,
    template_id TEXT REFERENCES templates(id) ON DELETE SET NULL
  )`);

  return ddls.join('\n') + '\n';
};

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

/**
 * Create a project backup archive.
 * @memberof backend.services.backupService
 * @param {Object} options - Backup options.
 * @param {Object} db - Database handle.
 * @returns {Promise<Object>}
 */
export async function createProjectBackup(options, { db }) {
  const { project_id, filePath } = options || {};
  
  if (!project_id) {
    throw new Error('project_id is required');
  }
  
  if (!filePath) {
    throw new Error('filePath is required');
  }

  // Ensure the file has .dctx extension
  const backupPath = filePath.toLowerCase().endsWith('.dctx') 
    ? filePath 
    : filePath + '.dctx';

  const projects = await db.select().from(dbSchema.project)
    .where(eq(dbSchema.project.id, project_id))
    .execute();
  
  if (!projects || projects.length === 0) {
    throw new Error(`Project ${project_id} not found`);
  }
  const project = projects[0];

  const languages = await db.select().from(dbSchema.languages)
    .where(eq(dbSchema.languages.project_id, project_id))
    .execute();
  const languageIds = languages.map(l => l.id);

  // Collect all text IDs from the project and related entities
  const textIds = new Set();
  if (project.title_id) textIds.add(project.title_id);
  if (project.description_id) textIds.add(project.description_id);

  // Settings
  const settings = await db.select().from(dbSchema.settings)
    .where(eq(dbSchema.settings.project_id, project_id))
    .execute();

  // Website settings
  const websiteSettings = await db.select().from(dbSchema.websiteSettings)
    .where(eq(dbSchema.websiteSettings.project_id, project_id))
    .execute();
  
  websiteSettings.forEach(ws => {
    if (ws.title_id) textIds.add(ws.title_id);
    if (ws.about_id) textIds.add(ws.about_id);
  });

  // Object display fields
  const objectDisplayFields = await db.select().from(dbSchema.object_display_fields)
    .where(eq(dbSchema.object_display_fields.project_id, project_id))
    .execute();

  // Institutions
  const institutions = await db.select().from(dbSchema.institutions)
    .where(eq(dbSchema.institutions.project_id, project_id))
    .execute();
  
  institutions.forEach(inst => {
    if (inst.name_id) textIds.add(inst.name_id);
    if (inst.description_id) textIds.add(inst.description_id);
    if (inst.country_id) textIds.add(inst.country_id);
    if (inst.location_id) textIds.add(inst.location_id);
  });
  const institutionIds = institutions.map(i => i.id);

  // Research fields
  const researchFields = await db.select().from(dbSchema.research_fields)
    .where(eq(dbSchema.research_fields.project_id, project_id))
    .execute();
  
  researchFields.forEach(rf => {
    if (rf.name_id) textIds.add(rf.name_id);
    if (rf.description_id) textIds.add(rf.description_id);
  });
  const researchFieldIds = researchFields.map(rf => rf.id);

  // Vocabularies
  const vocabularies = researchFieldIds.length > 0
    ? await db.select().from(dbSchema.vocabularies)
        .where(inArray(dbSchema.vocabularies.field_id, researchFieldIds))
        .execute()
    : [];
  
  vocabularies.forEach(v => {
    if (v.option_id) textIds.add(v.option_id);
    if (v.description_id) textIds.add(v.description_id);
  });
  const vocabularyIds = vocabularies.map(v => v.id);

  // Vocabularies generic assets junction
  const vocabulariesGenericAssets = vocabularyIds.length > 0
    ? await db.select().from(dbSchema.vocabularies_generic_assets)
        .where(inArray(dbSchema.vocabularies_generic_assets.vocabulary_id, vocabularyIds))
        .execute()
    : [];

  // Ontology fields
  const ontologyFields = await db.select().from(dbSchema.ontology_fields)
    .where(eq(dbSchema.ontology_fields.project_id, project_id))
    .execute();
  
  ontologyFields.forEach(of => {
    if (of.name_id) textIds.add(of.name_id);
    if (of.description_id) textIds.add(of.description_id);
    if (of.category_id) textIds.add(of.category_id);
  });
  const ontologyFieldIds = ontologyFields.map(of => of.id);

  // Templates
  const templates = await db.select().from(dbSchema.templates)
    .where(eq(dbSchema.templates.project_id, project_id))
    .execute();
  const templateIds = templates.map(t => t.id);

  // Datasources
  const datasources = institutionIds.length > 0
    ? await db.select().from(dbSchema.datasources)
        .where(inArray(dbSchema.datasources.institution_id, institutionIds))
        .execute()
    : [];
  
  datasources.forEach(ds => {
    if (ds.name_id) textIds.add(ds.name_id);
    if (ds.method_id) textIds.add(ds.method_id);
    if (ds.notes_id) textIds.add(ds.notes_id);
  });
  const datasourceIds = datasources.map(ds => ds.id);
  const importIds = datasources
    .map(ds => ds.import_id)
    .filter(id => typeof id === 'string' && id.trim());

  // Imports referenced by this project's datasources
  const imports = importIds.length > 0
    ? await db.select().from(dbSchema.imports)
        .where(inArray(dbSchema.imports.id, importIds))
        .execute()
    : [];

  // Objects
  const objects = await db.select().from(dbSchema.objects)
    .where(eq(dbSchema.objects.project_id, project_id))
    .execute();
  const objectIds = objects.map(o => o.id);

  // Objects Datasources junction (tracks object-datasource-template relationships)
  const objectsDatasources = objectIds.length > 0
    ? await db.select().from(dbSchema.objects_datasources)
        .where(inArray(dbSchema.objects_datasources.object_id, objectIds))
        .execute()
    : [];

  // Objects relationships
  const objectsResearchFields = objectIds.length > 0
    ? await db.select().from(dbSchema.objects_research_fields)
        .where(inArray(dbSchema.objects_research_fields.object_id, objectIds))
        .execute()
    : [];

  const objectsOntologyFields = objectIds.length > 0
    ? await db.select().from(dbSchema.objects_ontology_fields)
        .where(inArray(dbSchema.objects_ontology_fields.object_id, objectIds))
        .execute()
    : [];

  const objectsAssets = objectIds.length > 0
    ? await db.select().from(dbSchema.objects_assets)
        .where(inArray(dbSchema.objects_assets.object_id, objectIds))
        .execute()
    : [];

  // Assets
  const assets = await db.select().from(dbSchema.assets)
    .where(eq(dbSchema.assets.project_id, project_id))
    .execute();
  const normalizedAssets = normalizeProjectAssetRows(assets, project_id);
  const assetIds = assets.map(a => a.id);

  // Assets institutions junction
  const assetsInstitutions = assetIds.length > 0
    ? await db.select().from(dbSchema.assets_institutions)
        .where(inArray(dbSchema.assets_institutions.asset_id, assetIds))
        .execute()
    : [];

  // Generic assets
  const genericAssets = await db.select().from(dbSchema.genericAssets)
    .where(eq(dbSchema.genericAssets.project_id, project_id))
    .execute();
  const normalizedGenericAssets = normalizeProjectAssetRows(genericAssets, project_id);

  // Texts and translations
  const textIdsArray = Array.from(textIds);
  const texts = textIdsArray.length > 0
    ? await db.select().from(dbSchema.texts)
        .where(inArray(dbSchema.texts.id, textIdsArray))
        .execute()
    : [];

  const translations = textIdsArray.length > 0 && languageIds.length > 0
    ? await db.select().from(dbSchema.translations)
        .where(inArray(dbSchema.translations.text_id, textIdsArray))
        .execute()
    : [];

  const tmpBase = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'backup-'));
  const dataDir = path.join(tmpBase, 'data');
  await ensureDir(dataDir);

  const ddl = generateSchemaDDL();
  // Insert in correct order to respect foreign key constraints:
  // 1. Independent tables (no FK dependencies)
  // 2. Tables that reference only step 1
  // 3. Tables that reference step 1 & 2, etc.
  const inserts = [
    // First: project (root entity)
    generateInsertStatements('project', [project]),
    
    // Second: languages (no FK to other tables)
    generateInsertStatements('languages', languages),
    
    // Third: texts (depends on languages)
    generateInsertStatements('texts', texts),
    
    // Fourth: translations (depends on texts and languages)
    generateInsertStatements('translations', translations),
    
    // Fifth: settings and website_settings (depend on project and texts)
    generateInsertStatements('settings', settings),
    generateInsertStatements('website_settings', websiteSettings),
    
    // Sixth: institutions (depends on project and texts)
    generateInsertStatements('institutions', institutions),
    
    // Seventh: templates (depends on project)
    generateInsertStatements('templates', templates),
    
    // Eighth: research_fields (depends on project and texts)
    generateInsertStatements('research_fields', researchFields),
    
    // Ninth: generic_assets (depends on project and texts)
    generateInsertStatements('generic_assets', normalizedGenericAssets),
    
    // Tenth: vocabularies (depends on research_fields, texts, and generic_assets)
    generateInsertStatements('vocabularies', vocabularies),
    
    // Eleventh: vocabularies_generic_assets (depends on vocabularies and generic_assets)
    generateInsertStatements('vocabularies_generic_assets', vocabulariesGenericAssets),
    
    // Twelfth: ontology_fields (depends on project and texts)
    generateInsertStatements('ontology_fields', ontologyFields),
    
    // Thirteenth: object_display_fields (depends on project, ontology_fields, research_fields)
    generateInsertStatements('object_display_fields', objectDisplayFields),
    
    // Fourteenth: imports (standalone now, no datasource dependency)
    generateInsertStatements('imports', imports),
    
    // Fifteenth: datasources (depends on institutions and texts, optionally imports)
    generateInsertStatements('datasources', datasources),
    
    // Sixteenth: assets (depends on project and institutions)
    generateInsertStatements('assets', normalizedAssets),
    
    // Seventeenth: objects (depends on project and institutions)
    generateInsertStatements('objects', objects),
    
    // Eighteenth: junction/relationship tables (depend on their parent tables)
    generateInsertStatements('objects_research_fields', objectsResearchFields),
    generateInsertStatements('objects_ontology_fields', objectsOntologyFields),
    generateInsertStatements('objects_assets', objectsAssets),
    generateInsertStatements('assets_institutions', assetsInstitutions),
    generateInsertStatements('objects_datasources', objectsDatasources),
  ].join('\n');

  const sqlContent = ddl + '\n' + inserts;
  const sqlFile = path.join(dataDir, 'backup.sql');
  await fsPromises.writeFile(sqlFile, sqlContent, 'utf-8');

  let projectTitle = project.title_id;
  if (project.title_id) {
    const titleText = texts.find(t => t.id === project.title_id);
    if (titleText) {
      projectTitle = titleText.content;
    }
  }

  const metadata = {
    version: '1.0',
    created_at: new Date().toISOString(),
    project_id: project_id,
    project_title: projectTitle,
    counts: {
      objects: objects.length,
      institutions: institutions.length,
      assets: assets.length,
      genericAssets: genericAssets.length,
      languages: languages.length,
      texts: texts.length,
      translations: translations.length,
    }
  };
  await writeJsonFile(path.join(tmpBase, 'metadata.json'), metadata);

  const projectAssetsFolder = resolveProjectAssetPath(project_id);
  let copiedAssets = 0;
  
  if (fs.existsSync(projectAssetsFolder)) {
    const assetsDestDir = path.join(tmpBase, 'project_assets');
    await fsPromises.cp(projectAssetsFolder, assetsDestDir, { recursive: true });
    
    const files = await fsPromises.readdir(assetsDestDir, { recursive: true });
    copiedAssets = files.filter(f => {
      const fullPath = path.join(assetsDestDir, f);
      return fs.statSync(fullPath).isFile();
    }).length;
  }

  await createZipFromFolder(tmpBase, backupPath);

  await removePathQuietly(tmpBase, { recursive: true });

  return {
    success: true,
    filePath: backupPath,
    metadata,
    copiedAssets
  };
}

async function extractZipToFolder(zipPath, destFolder) {
  await ensureDir(destFolder);
  
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
        } else {
          zipfile.openReadStream(entry, async (err, readStream) => {
            if (err) return reject(err);
            
            const destPath = path.join(destFolder, entry.fileName);
            await ensureDir(path.dirname(destPath));
            
            const writeStream = fs.createWriteStream(destPath);
            readStream.pipe(writeStream);
            
            writeStream.on('close', () => {
              zipfile.readEntry();
            });
            
            writeStream.on('error', reject);
          });
        }
      });
      
      zipfile.on('end', () => resolve(true));
      zipfile.on('error', reject);
    });
  });
}

/**
 * Check whether a project exists in the database.
 * @memberof backend.services.backupService
 * @param {string} project_id - Project identifier.
 * @param {Object} db - Database handle.
 * @returns {Promise<boolean>}
 */
export async function checkProjectExists(project_id, { db }) {
  const projects = await db.select().from(dbSchema.project)
    .where(eq(dbSchema.project.id, project_id))
    .execute();
  
  return projects && projects.length > 0;
}

/**
 * Open a .dctx backup file, read its metadata.json, and check if the project
 * it belongs to already exists in the local database.
 */
/**
 * Inspect a backup archive and return its metadata and validation state.
 * @memberof backend.services.backupService
 * @param {string} filePath - Backup file path.
 * @param {Object} db - Database handle.
 * @returns {Promise<Object>}
 */
export async function inspectBackupFile(filePath, { db }) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file not found');
  }

  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      let metadataContent = null;

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        if (entry.fileName === 'metadata.json') {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);

            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', async () => {
              try {
                metadataContent = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                const projectExists = await checkProjectExists(metadataContent.project_id, { db });
                zipfile.close();
                resolve({
                  success: true,
                  metadata: metadataContent,
                  projectExists
                });
              } catch (parseErr) {
                reject(parseErr);
              }
            });
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!metadataContent) {
          reject(new Error('Invalid backup file: missing metadata.json'));
        }
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Restore a project backup archive.
 * @memberof backend.services.backupService
 * @param {Object} options - Restore options.
 * @param {Object} db - Database handle.
 * @returns {Promise<Object>}
 */
export async function restoreProjectBackup(options, { db }) {
  const { filePath, strategy = 'merge', preserveProjectRow = false } = options || {};
  
  if (!filePath) {
    throw new Error('filePath is required');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file not found');
  }

  const tmpBase = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'restore-'));
  
  try {
    await extractZipToFolder(filePath, tmpBase);

    const metadataPath = path.join(tmpBase, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Invalid backup file: missing metadata.json');
    }

    const metadata = await readJsonFile(metadataPath);
    const { project_id } = metadata;

    if (!project_id) {
      throw new Error('Invalid backup: missing project_id in metadata');
    }

    const projectExists = await checkProjectExists(project_id, { db });

    const sqlPath = path.join(tmpBase, 'data', 'backup.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error('Invalid backup file: missing backup.sql');
    }

    const sqlContent = await fsPromises.readFile(sqlPath, 'utf-8');
    
    // Temporarily disable foreign key checks to handle restore order issues
    await db.run('PRAGMA foreign_keys = OFF;');
    
    try {
      // Execute SQL statements
      const statements = splitSqlStatements(sqlContent);

      for (const rawStmt of statements) {
        try {
          const tableName = rawStmt.match(/INSERT OR REPLACE INTO (\w+)/i)?.[1] || 'unknown';
          const stmt = preserveProjectRow && tableName === 'project'
            ? convertProjectReplaceToUpsert(rawStmt)
            : rawStmt;

          await db.run(stmt + ';');
        } catch (err) {
          const tableName = rawStmt.match(/INSERT OR REPLACE INTO (\w+)/i)?.[1] || 'unknown';
          const idMatch = rawStmt.match(/"id"\s*,.*?VALUES\s*\('([^']+)'/i);
          const rowId = idMatch?.[1] || 'unknown';
          
          console.error(`[RESTORE] Error in table "${tableName}", row id: "${rowId}"`);
          console.error(`[RESTORE] SQL statement: ${rawStmt.substring(0, 200)}...`);
          console.error(`[RESTORE] Error:`, err.message);
          // Continue with other statements even if one fails
        }
      }
    } finally {
      // Re-enable foreign key checks
      await db.run('PRAGMA foreign_keys = ON;');
    }

    const assetsSourceDir = path.join(tmpBase, 'project_assets');
    let copiedAssets = 0;

    if (fs.existsSync(assetsSourceDir)) {
      const assetsDestDir = resolveProjectAssetPath(project_id);
      
      if (strategy === 'overwrite' && fs.existsSync(assetsDestDir)) {
        await removePathRobust(assetsDestDir, { recursive: true });
      }
      
      await ensureDir(assetsDestDir);
      await fsPromises.cp(assetsSourceDir, assetsDestDir, { 
        recursive: true,
        force: strategy === 'overwrite'
      });
      
      const files = await fsPromises.readdir(assetsDestDir, { recursive: true });
      copiedAssets = files.filter(f => {
        const fullPath = path.join(assetsDestDir, f);
        return fs.statSync(fullPath).isFile();
      }).length;
    }

    await normalizeRestoredAssetRows(project_id, { db });

    await removePathQuietly(tmpBase, { recursive: true });

    return {
      success: true,
      project_id,
      metadata,
      copiedAssets,
      existed: projectExists,
      strategy
    };
  } catch (error) {
    await removePathQuietly(tmpBase, { recursive: true });
    throw error;
  }
}
