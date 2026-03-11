/**
 * Unified search interface that works in both preview mode (DB) and static export mode (JSON)
 */

import { resolveSitePath } from '$lib/utils/sitePaths.js';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

// Cache for static data (loaded once from data.json)
let staticDataCache = null;

/**
 * Load static data from data.json (only in static export mode)
 * @param {Function} customFetch - Optional fetch function (for SSR)
 */
async function getStaticData(customFetch = fetch) {
  if (staticDataCache) return staticDataCache;
  
  try {
    const response = await customFetch(resolveSitePath('data.json'));
    if (!response.ok) throw new Error(`Failed to load data.json: ${response.statusText}`);
    staticDataCache = await response.json();
    return staticDataCache;
  } catch (e) {
    console.error('[search] Failed to load static data:', e);
    return { objects: [], institutions: [] };
  }
}

/**
 * Search objects - automatically uses the right implementation based on build mode
 * @param {Object} options - Search options
 * @param {Function} customFetch - Optional fetch function (for SSR)
 */
export async function searchObjects(options, customFetch = fetch) {
  
  if (isStaticExport) {
    return searchObjectsStatic(options, customFetch);
  } else {
    // Dynamic import to avoid bundling DB code in static export
    const { searchObjects: dbSearch } = await import('./searchUtils.js');
    return dbSearch(options);
  }
}

/**
 * Static search implementation using data.json
 * @param {Function} customFetch - Optional fetch function (for SSR)
 */
async function searchObjectsStatic({
  q = '',
  page = 1,
  pageSize = 10,
  institution_ids = [],
  researchFieldFilters = [],
  textFieldFilters = [],
  orderBy = 'created_at',
  direction = 'desc'
}, customFetch = fetch) {
  const data = await getStaticData(customFetch);
  const objects = data.objects || [];
  const institutions = data.institutions || [];
  const vocabularies = data.vocabularies || [];
  const researchFields = data.research_fields || [];

  // Filter by search query - mirrors preview mode logic
  // Searches: object name, ontology field values, research field values, institution name
  let filtered = objects;
  if (q && q.trim()) {
    const searchLower = q.toLowerCase().trim();
    filtered = objects.filter(obj => {
      // Object name search
      if (obj.name?.toLowerCase().includes(searchLower)) return true;
      
      // Ontology fields value search
      if (obj.objectOntologyFields?.some(oof => 
        oof.value?.toLowerCase().includes(searchLower)
      )) return true;
      
      // Research fields value search
      if (obj.objectResearchFields?.some(orf => 
        orf.value?.toLowerCase().includes(searchLower)
      )) return true;
      
      // Institution name search
      if (obj.institution?.name?.toLowerCase().includes(searchLower)) return true;
      
      return false;
    });
  }

  // Filter by institution
  if (institution_ids && institution_ids.length > 0) {
    filtered = filtered.filter(obj => institution_ids.includes(obj.institution_id));
  }

  // Filter by ontology field text queries (textFieldFilters)
  // Format: [{ kind: 'ontology', fieldId: '...', query: '...' }, ...]
  if (textFieldFilters && textFieldFilters.length > 0) {
    filtered = filtered.filter(obj => {
      if (!obj.objectOntologyFields || obj.objectOntologyFields.length === 0) return false;
      
      // Object must match ALL text field filters (AND)
      return textFieldFilters.every(tf => {
        if (!tf || tf.kind !== 'ontology' || !tf.fieldId || !tf.query) return true;
        const queryLower = tf.query.toLowerCase().trim();
        return obj.objectOntologyFields.some(oof => 
          oof.field_id === tf.fieldId && 
          oof.value?.toLowerCase().includes(queryLower)
        );
      });
    });
  }

  // Filter by research fields (vocabulary filters and text queries)
  // Format from component: [{ fieldId, vocabularyIds: [...], query: '...' }, ...]
  if (researchFieldFilters && researchFieldFilters.length > 0) {
    filtered = filtered.filter(obj => {
      if (!obj.objectResearchFields || obj.objectResearchFields.length === 0) return false;
      
      // Object must match ALL filter groups (AND between fields)
      return researchFieldFilters.every(filter => {
        // If filter has a text query for research field
        if (filter.query && filter.query.trim()) {
          const queryLower = filter.query.toLowerCase().trim();
          const hasMatch = obj.objectResearchFields.some(rf => 
            rf.field_id === filter.fieldId && 
            rf.value?.toLowerCase().includes(queryLower)
          );
          if (hasMatch) return true;
        }
        
        // If filter has vocabularyIds array, check if object has any of them
        if (filter.vocabularyIds && filter.vocabularyIds.length > 0) {
          return obj.objectResearchFields.some(rf => 
            filter.vocabularyIds.includes(rf.vocabulary_id)
          );
        }
        // If filter has a single vocabulary_id (legacy format)
        if (filter.vocabulary_id) {
          return obj.objectResearchFields.some(rf => 
            rf.vocabulary_id === filter.vocabulary_id
          );
        }
        return true; // No constraint
      });
    });
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal = a[orderBy];
    let bVal = b[orderBy];
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';
    
    if (typeof aVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return direction === 'desc' ? -cmp : cmp;
    }
    const cmp = (aVal || 0) - (bVal || 0);
    return direction === 'desc' ? -cmp : cmp;
  });

  // Calculate institution facets from filtered results
  const institutionCounts = new Map();
  filtered.forEach(obj => {
    if (obj.institution_id) {
      institutionCounts.set(obj.institution_id, (institutionCounts.get(obj.institution_id) || 0) + 1);
    }
  });

  const institutionFacets = [];
  institutionCounts.forEach((count, instId) => {
    const inst = institutions.find(i => i.id === instId);
    institutionFacets.push({
      institution_id: instId,
      name: inst?.name || 'Unknown',
      count
    });
  });
  institutionFacets.sort((a, b) => b.count - a.count);

  // Calculate research field (vocabulary) facets from filtered results
  const vocabCounts = new Map(); // vocabulary_id -> count
  filtered.forEach(obj => {
    if (obj.objectResearchFields) {
      obj.objectResearchFields.forEach(rf => {
        if (rf.vocabulary_id) {
          vocabCounts.set(rf.vocabulary_id, (vocabCounts.get(rf.vocabulary_id) || 0) + 1);
        }
      });
    }
  });

  const researchFieldFacets = [];
  vocabCounts.forEach((count, vocabId) => {
    const vocab = vocabularies.find(v => v.id === vocabId);
    if (vocab) {
      const field = researchFields.find(rf => rf.id === vocab.field_id);
      researchFieldFacets.push({
        field_id: vocab.field_id,
        vocabulary_id: vocabId,
        name: vocab.name || 'Unknown',
        field_name: field?.name || 'Unknown',
        count
      });
    }
  });
  researchFieldFacets.sort((a, b) => b.count - a.count);

  // Paginate
  const totalCount = filtered.length;
  const startIndex = (page - 1) * pageSize;
  // Map items to include objects_assets_json for GridCard compatibility
  const items = filtered.slice(startIndex, startIndex + pageSize).map(obj => ({
    ...obj,
    // GridCard expects objects_assets_json, but export creates assets
    objects_assets_json: obj.objects_assets_json || obj.assets || []
  }));

  return {
    items,
    totalCount,
    page,
    pageSize,
    facets: {
      institution_ids: institutionFacets,
      ontology_fields: [],
      research_fields: researchFieldFacets
    }
  };
}
