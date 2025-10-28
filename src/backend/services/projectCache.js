// Simple in-memory project ID cache for single-user Electron app
import * as Y from 'yjs';

// Y.Doc registry keyed by projectId (map-first schema)
const projectDocs = new Map();

// Tables covered by the current sync plan (map keyed by row id)
const TABLES = [
  'project',
  'settings',
  'website_settings',
  'object_display_fields',
  'research_fields',
  'ontology_fields',
  'assets',
  'generic_assets',
  'objects',
  'templates',
  'languages',
  'institutions',
  'texts',
  'translations',
  'vocabularies',
  'datasources',
  'imports',
  'objects_assets',
  'assets_institutions',
  'objects_research_fields',
  'objects_ontology_fields',
  'vocabularies_generic_assets'
];

/**
 * Ensure the canonical map-first schema exists on a Y.Doc
 * - Root map: 'tables'
 * - Per-table: Y.Map keyed by row id → value is a Y.Map of fields
 */
const ensureDocSchema = (doc, projectId) => {
  const meta = doc.getMap('meta');
  if (meta.get('project_id') !== projectId) {
    meta.set('project_id', projectId);
  }

  const tables = doc.getMap('tables');
  for (const t of TABLES) {
    if (!tables.get(t)) {
      tables.set(t, new Y.Map());
    }
  }
  return tables;
};

/**
 * Get or create the Y.Doc for a project.
 * Ensures the map-first schema is initialized.
 */
export const getProjectDoc = (projectId) => {
  let doc = projectDocs.get(projectId);
  if (!doc) {
    doc = new Y.Doc({ guid: `project:${projectId}` });
    projectDocs.set(projectId, doc);
  }
  ensureDocSchema(doc, projectId);
  return doc;
};

/**
 * Dispose and remove the Y.Doc for a project.
 */
export const disposeProjectDoc = (projectId) => {
  const doc = projectDocs.get(projectId);
  if (doc) {
    try {
      doc.destroy();
    } catch (err) {
      console.warn('Error destroying Y.Doc', err);
    }
    projectDocs.delete(projectId);
  }
};

/**
 * Ensure and return the table map for a given project and table name.
 */
export const ensureTableMap = (projectId, tableName) => {
  const doc = getProjectDoc(projectId);
  const tables = doc.getMap('tables');
  if (!tables.get(tableName)) {
    tables.set(tableName, new Y.Map());
  }
  return tables.get(tableName);
};

/**
 * Ensure and return the row map for a given project, table, and row id.
 */
export const ensureRowMap = (projectId, tableName, rowId) => {
  const table = ensureTableMap(projectId, tableName);
  let row = table.get(rowId);
  if (!row) {
    row = new Y.Map();
    table.set(rowId, row);
  }
  return row;
};

/**
 * Set multiple fields on a row map (merge behavior)
 */
export const setRowFields = (rowMap, fieldsObj) => {
  Object.entries(fieldsObj).forEach(([k, v]) => {
    rowMap.set(k, v);
  });
};

/**
 * Delete a row by id from a table map.
 */
export const deleteRow = (projectId, tableName, rowId) => {
  const table = ensureTableMap(projectId, tableName);
  table.delete(rowId);
};
let currentProjectId = null;

/**
 * Set the current project ID
 * @param {string} projectId - The project ID to cache
 */
export const setCurrentProjectId = (projectId) => {
    currentProjectId = projectId;
    console.log(`Project ID cached: ${projectId}`);
};

/**
 * Get the current cached project ID
 * @returns {string|null} The cached project ID or null if not set
 */
export const getCurrentProjectId = () => {
    return currentProjectId;
};

/**
 * Clear the cached project ID
 */
export const clearCurrentProjectId = () => {
    currentProjectId = null;
    console.log('Project ID cache cleared');
};

/**
 * Check if a project ID is currently cached
 * @returns {boolean} True if a project ID is cached
 */
export const hasCurrentProjectId = () => {
  return currentProjectId !== null;
};