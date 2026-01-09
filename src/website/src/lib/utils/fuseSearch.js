import Fuse from 'fuse.js';

let fuseInstance = null;

/**
 * Initialize Fuse.js search index
 */
export function initializeSearch(objects) {
  const options = {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'institution.name', weight: 1.5 },
      { name: 'institution.description', weight: 0.5 },
      { name: 'objectOntologyFields.value', weight: 1 },
      { name: 'objectResearchFields.value', weight: 1 }
    ],
    threshold: 0.3,
    ignoreLocation: true,
    useExtendedSearch: true,
    includeScore: true
  };
  
  fuseInstance = new Fuse(objects, options);
  return fuseInstance;
}

/**
 * Search objects using Fuse.js
 */
export function searchObjects(query, objects) {
  if (!fuseInstance) {
    initializeSearch(objects);
  }
  
  if (!query || query.trim() === '') {
    return objects;
  }
  
  const results = fuseInstance.search(query);
  return results.map(result => result.item);
}

/**
 * Filter objects by institution IDs
 */
export function filterByInstitutions(objects, institutionIds) {
  if (!institutionIds || institutionIds.length === 0) {
    return objects;
  }
  
  return objects.filter(obj => 
    obj.institution_id && institutionIds.includes(obj.institution_id)
  );
}

/**
 * Combined search and filter
 */
export function searchAndFilter(allObjects, { query = '', institutionIds = [] }) {
  let filtered = allObjects;
  
  // Apply institution filter
  if (institutionIds && institutionIds.length > 0) {
    filtered = filterByInstitutions(filtered, institutionIds);
  }
  
  // Apply search query
  if (query && query.trim() !== '') {
    filtered = searchObjects(query, filtered);
  }
  
  return filtered;
}
