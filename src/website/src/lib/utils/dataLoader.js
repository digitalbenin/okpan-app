import { browser } from '$app/environment';

const isStaticMode = typeof window !== 'undefined' && window.location.protocol === 'file:';

let cachedData = null;

/**
 * Load all data from data.json (static export mode) or database (preview mode)
 * @param {Function} [customFetch] - SvelteKit's fetch function
 */
export async function loadAllData(customFetch = fetch) {
  // Static export mode: load from data.json
  if (isStaticMode || import.meta.env.VITE_USE_JSON === 'true') {
    if (!cachedData) {
      const response = await customFetch('/data.json');
      if (!response.ok) {
        throw new Error(`Failed to load data.json: ${response.statusText}`);
      }
      cachedData = await response.json();
    }
    return cachedData;
  }
  
  // Preview mode: use database
  if (!browser) {
    return { 
      objects: [], 
      institutions: [], 
      research_fields: [], 
      ontology_fields: [], 
      vocabularies: [],
      project: {},
      settings: {}
    };
  }
  
  // Dynamic import to avoid loading dbUtils in static mode
  const { getDb, fetchAllData } = await import('./dbUtils.js');
  const db = await getDb();
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  const url = new URL(window.location.href);
  const projectId = url.searchParams.get('project_id');
  
  return fetchAllData(db, projectId);
}

/**
 * Get a single object by ID
 * @param {string} objectId
 * @param {Function} [customFetch]
 */
export async function getObjectById(objectId, customFetch = fetch) {
  const data = await loadAllData(customFetch);
  return data.objects.find(obj => obj.id === objectId);
}
