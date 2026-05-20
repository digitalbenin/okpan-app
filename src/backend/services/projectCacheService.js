/**
 * In-memory project cache service for Yjs documents and active project state.
 *
 * @namespace backend.services.projectCacheService
 * @memberof backend.services
 */
// Simple in-memory project ID cache for single-user Electron app
import * as Y from 'yjs';

// Y.Doc registry keyed by projectId (map-first schema)
const projectDocs = new Map();
let globalClientIdNumber = undefined;

/**
 * Set a stable client id for every cached Y.Doc.
 * @memberof backend.services.projectCacheService
 * @method
 * @param {string} idStr - Stable identifier string.
 * @returns {void}
 */
export const setGlobalClientIdNumber = (idStr) => {
  if (!idStr) return;
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
      hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
  }
  globalClientIdNumber = Math.abs(hash);
  // Re-apply to any currently existing docs to stabilize them immediately
  for (const doc of projectDocs.values()) {
    doc.clientID = globalClientIdNumber;
  }
};

/**
 * Get or create the Y.Doc for a project.
 * @memberof backend.services.projectCacheService
 * @method
 * @param {string} projectId - Project identifier.
 * @returns {Y.Doc}
 */
export const getProjectDoc = (projectId) => {
  let doc = projectDocs.get(projectId);
  if (!doc) {
    const opts = { guid: `project:${projectId}` };
    if (globalClientIdNumber !== undefined) opts.clientID = globalClientIdNumber;
    doc = new Y.Doc(opts);
    projectDocs.set(projectId, doc);
  }
  return doc;
};

/**
 * Replace the in-memory Y.Doc for a project with a fresh empty instance.
 * @memberof backend.services.projectCacheService
 * @method
 * @param {string} projectId - Project identifier.
 * @returns {Y.Doc}
 */
export const replaceProjectDoc = (projectId) => {
  disposeProjectDoc(projectId);
  return getProjectDoc(projectId);
};

/**
 * Dispose and remove the Y.Doc for a project.
 * @memberof backend.services.projectCacheService
 * @method
 * @param {string} projectId - Project identifier.
 * @returns {void}
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
 * @memberof backend.services.projectCacheService
 * @method
 * @param {string} projectId - Project identifier.
 * @param {string} tableName - Table name.
 * @returns {Y.Map}
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
 * @memberof backend.services.projectCacheService
 * @method
 * @param {string} projectId - Project identifier.
 * @param {string} tableName - Table name.
 * @param {string} rowId - Row identifier.
 * @returns {Y.Map}
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
 * Set multiple fields on a row map with merge semantics.
 * @memberof backend.services.projectCacheService
 * @method
 * @param {Y.Map} rowMap - Row map to update.
 * @param {Object} fieldsObj - Fields to merge into the row.
 * @returns {void}
 */
export const setRowFields = (rowMap, fieldsObj) => {
  Object.entries(fieldsObj).forEach(([k, v]) => {
     const current = rowMap.get(k);
     let isDifferent = current !== v;

     // Fast path for primitives, but for objects/arrays/dates we use stringification or value comparison
     if (isDifferent && current != null && v != null && typeof current === 'object' && typeof v === 'object') {
       if (current instanceof Date && v instanceof Date) {
         isDifferent = current.getTime() !== v.getTime();
       } else {
         try {
           // Provide basic deep equality for JSON string/arrays
           isDifferent = JSON.stringify(current) !== JSON.stringify(v);
         } catch (e) {
           isDifferent = true; // Fallback to updating if stringify fails
         }
       }
     }

     if (isDifferent) {
        rowMap.set(k, v);
     }
  });
};

/**
 * Delete a row by id from a table map.
 * @memberof backend.services.projectCacheService
 * @method
 * @param {string} projectId - Project identifier.
 * @param {string} tableName - Table name.
 * @param {string} rowId - Row identifier.
 * @returns {void}
 */
export const deleteRow = (projectId, tableName, rowId) => {
  const table = ensureTableMap(projectId, tableName);
  table.delete(rowId);
};
let currentProjectId = null;

/**
 * Set the current project ID.
 * @memberof backend.services.projectCacheService
 * @method
 * @param {string} projectId - The project ID to cache.
 * @returns {void}
 */
export const setCurrentProjectId = (projectId) => {
    currentProjectId = projectId;
    console.log(`Project ID cached: ${projectId}`);
};

/**
 * Get the current cached project ID.
 * @memberof backend.services.projectCacheService
 * @method
 * @returns {string|null}
 */
export const getCurrentProjectId = () => {
    return currentProjectId;
};

/**
 * Clear the cached project ID.
 * @memberof backend.services.projectCacheService
 * @method
 * @returns {void}
 */
export const clearCurrentProjectId = () => {
    currentProjectId = null;
    console.log('Project ID cache cleared');
};

/**
 * Check whether a project ID is currently cached.
 * @memberof backend.services.projectCacheService
 * @method
 * @returns {boolean}
 */
export const hasCurrentProjectId = () => {
  return currentProjectId !== null;
};