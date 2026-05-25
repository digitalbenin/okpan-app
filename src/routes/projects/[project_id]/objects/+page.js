import { browser } from '$app/environment';
import { searchObjects } from "$lib/api/ObjectsApi.js";

export const load = async ({ params, depends, url }) => {
    if (!browser) return;
    depends('app:objects');

    const projectId = params.project_id;

    // Read query params
    const pageSizeStr = url.searchParams.get('pageSize');
    const pageStr = url.searchParams.get('page');
    const orderBy = url.searchParams.get('orderBy') || 'updated_at';
    const direction = url.searchParams.get('direction') || 'asc';
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const searchField = url.searchParams.get('searchField') || 'all';
    const filtersParam = url.searchParams.get('filters');

    // Decode advanced filters from querystring (JSON string encoded via encodeURIComponent)
    let advancedFilters = {};
    if (filtersParam) {
        try {
            advancedFilters = JSON.parse(decodeURIComponent(filtersParam)) || {};
        } catch (e) {
            console.warn('[objects/+page.js] Failed to decode filters param', e);
            advancedFilters = {};
        }
    }

    const page = (pageStr ? parseInt(pageStr) : 1) - 1;
    const pageSize = pageSizeStr ? parseInt(pageSizeStr) : 25;

    const opts = { projectId, page, pageSize, orderBy, direction };

    // Status filter
    if (status && status !== 'all') {
        opts.status = status;
    }

    // Institution filter from advanced panel
    const instIds = Array.isArray(advancedFilters.institutions)
        ? advancedFilters.institutions.filter(Boolean)
        : [];
    if (instIds.length) {
        opts.institutionIds = instIds;
    }

    // Research field filters (vocabulary selections and text queries)
    const researchFieldFilters = [];
    // Vocabulary selections: keys in advancedFilters other than __textFilters and institutions
    Object.entries(advancedFilters || {}).forEach(([key, val]) => {
        if (key === '__textFilters' || key === 'institutions') return;
        if (Array.isArray(val) && val.length > 0) {
            researchFieldFilters.push({ fieldId: key, vocabularyIds: val });
        }
    });

    // Text filters: __textFilters contains items with kind 'research' or 'ontology'
    const textFilters = Array.isArray(advancedFilters.__textFilters)
        ? advancedFilters.__textFilters
        : [];

    const ontologyFieldQueries = [];
    for (const tf of textFilters) {
        if (!tf || !tf.query || !String(tf.query).trim()) continue;
        if (String(tf.kind) === 'research') {
            researchFieldFilters.push({ fieldId: tf.fieldId, query: tf.query });
        } else if (String(tf.kind) === 'ontology') {
            ontologyFieldQueries.push({ fieldId: tf.fieldId, query: tf.query });
        }
    }

    if (researchFieldFilters.length) {
        opts.researchFieldFilters = researchFieldFilters;
    }
    if (ontologyFieldQueries.length) {
        opts.ontologyFieldQueries = ontologyFieldQueries;
    }

    // Top search input: map to ontologyFieldQueries or genericQuery
    if (search && String(search).trim()) {
        // Treat 'all' or 'name' as generic free text search (backend handles name within genericQuery)
        if (searchField === 'all' || searchField === 'name' || !searchField) {
            opts.genericQuery = search;
        } else {
            opts.ontologyFieldQueries = [
                ...(opts.ontologyFieldQueries || []),
                { fieldId: searchField, query: search }
            ];
        }
    }

    // Execute faceted object search
    const objectsData = await searchObjects(opts);

    return {
        objects: objectsData,
    };
};

