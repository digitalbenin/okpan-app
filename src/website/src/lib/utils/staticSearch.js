/**
 * Client-side search for static export mode
 * Uses data loaded from data.json (provided by layout)
 */

/**
 * Search objects from pre-loaded data
 * @param {Object} options
 * @param {Object} options.data - Data from parent layout (includes objects array from data.json)
 * @param {string} [options.q] - Search query
 * @param {number} [options.page] - Page number (1-indexed)
 * @param {number} [options.pageSize] - Items per page
 * @param {string[]} [options.institution_ids] - Filter by institution IDs
 * @param {string} [options.orderBy] - Sort field
 * @param {string} [options.direction] - Sort direction
 */
export async function searchObjectsStatic({
  data,
  q = '',
  page = 1,
  pageSize = 10,
  institution_ids = [],
  orderBy = 'created_at',
  direction = 'desc'
}) {
  // Load objects from data.json via fetch if not in data
  let objects = data?.objects || [];
  
  if (!objects.length && typeof fetch !== 'undefined') {
    try {
      const response = await fetch('/data.json');
      if (response.ok) {
        const jsonData = await response.json();
        objects = jsonData.objects || [];
      }
    } catch (e) {
      console.warn('[staticSearch] Could not load data.json:', e);
    }
  }

  // Filter by search query
  let filtered = objects;
  if (q && q.trim()) {
    const searchLower = q.toLowerCase().trim();
    filtered = objects.filter(obj => {
      // Search in inventory number
      if (obj.inventory_number?.toLowerCase().includes(searchLower)) return true;
      // Search in title
      if (obj.title?.toLowerCase().includes(searchLower)) return true;
      // Search in description
      if (obj.description?.toLowerCase().includes(searchLower)) return true;
      return false;
    });
  }

  // Filter by institution
  if (institution_ids && institution_ids.length > 0) {
    filtered = filtered.filter(obj => institution_ids.includes(obj.institution_id));
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal = a[orderBy];
    let bVal = b[orderBy];
    
    // Handle null/undefined
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';
    
    // String comparison
    if (typeof aVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return direction === 'desc' ? -cmp : cmp;
    }
    
    // Numeric comparison
    const cmp = aVal - bVal;
    return direction === 'desc' ? -cmp : cmp;
  });

  // Calculate facets from ALL objects (not filtered), but counts from filtered
  const institutionCounts = new Map();
  filtered.forEach(obj => {
    if (obj.institution_id) {
      institutionCounts.set(obj.institution_id, (institutionCounts.get(obj.institution_id) || 0) + 1);
    }
  });

  // Build institution facets with names from data.institutions
  const institutionFacets = [];
  const institutions = data?.institutions || [];
  institutionCounts.forEach((count, instId) => {
    const inst = institutions.find(i => i.id === instId);
    institutionFacets.push({
      institution_id: instId,
      name: inst?.name || 'Unknown',
      count
    });
  });
  institutionFacets.sort((a, b) => b.count - a.count);

  // Paginate
  const totalCount = filtered.length;
  const startIndex = (page - 1) * pageSize;
  const items = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items,
    totalCount,
    page,
    pageSize,
    facets: {
      institution_ids: institutionFacets,
      ontology_fields: [],
      research_fields: []
    }
  };
}
