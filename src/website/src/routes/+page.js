import { browser } from '$app/environment';
import { resolveProjectId } from '$lib/utils/projectContext.js';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

// Homepage should NOT be prerendered in static export - it's interactive (search, filtering)
// We disable SSR so it generates a minimal shell, and data.json is loaded client-side
export const ssr = !isStaticExport;

/** @type {import('./$types').PageLoad} */
export async function load({ url, fetch, parent }) {
	// For static export: return skeleton data - client will load data.json via onMount
	if (isStaticExport) {
		return {
			searchResult: {
				items: [],
				totalCount: 0,
				page: 1,
				pageSize: 25,
				facets: { institution_ids: [], ontology_fields: [], research_fields: [] }
			},
			queryParams: {
				projectId: null,
				q: '',
				page: 1,
				pageSize: 25,
				institutionIds: [],
				orderBy: 'created_at',
				direction: 'desc'
			},
			// Flag to indicate client needs to load data
			needsClientLoad: true
		};
	}

	// Preview mode: parse query params (only available client-side or non-prerendered)
	const projectId = resolveProjectId(url);
	const queryParams = {
		projectId,
		q: url.searchParams.get('q') || '',
		page: parseInt(url.searchParams.get('page') || '1'),
		pageSize: parseInt(url.searchParams.get('pageSize') || url.searchParams.get('limit') || '10'),
		institutionIds: url.searchParams.getAll('institutionId'),
		researchFieldFilters: [], // website UI doesn't use this yet, but reserved for future
		orderBy: url.searchParams.get('orderBy') || 'created_at',
		direction: url.searchParams.get('direction') || 'desc'
	};

	// Preview mode: During SSR return empty - actual search happens client-side
	if (!browser) {
		return {
			searchResult: {
				items: [],
				totalCount: 0,
				page: 1,
				pageSize: queryParams.pageSize,
				facets: { institution_ids: [], ontology_fields: [], research_fields: [] }
			},
			queryParams
		};
	}

	// Client-side: use unified search (handles both static and preview mode)
	const { searchObjects } = await import('$lib/utils/search.js');

	// Read stored filters from layout (website settings) — these define the corpus
	let storedFilters = {};
	try {
		const parentData = await parent();
		storedFilters = parentData?.settings?.filters || {};
	} catch {
		storedFilters = {};
	}
	console.log('[WebsitePreview] storedFilters from DB:', storedFilters);

	// Merge stored filters (corpus definition) with website's own query params (user filtering within corpus)
	const searchParams = {
		project_id: queryParams.projectId,
		q: queryParams.q,
		page: queryParams.page,
		pageSize: queryParams.pageSize,
		orderBy: queryParams.orderBy,
		direction: queryParams.direction
	};

	// Status from stored filters (corpus definition) — always applied
	if (storedFilters.status && storedFilters.status !== 'all') {
		searchParams.status = storedFilters.status;
	}

	// Institutions: corpus filter defines the base set; user filter narrows within it
	const corpusInstitutionIds = storedFilters.institutionIds?.length ? storedFilters.institutionIds : null;
	const userInstitutionIds = queryParams.institutionIds?.length ? queryParams.institutionIds : null;
	if (corpusInstitutionIds && userInstitutionIds) {
		searchParams.institution_ids = userInstitutionIds.filter(id => corpusInstitutionIds.includes(id));
	} else if (corpusInstitutionIds) {
		searchParams.institution_ids = corpusInstitutionIds;
	} else if (userInstitutionIds) {
		searchParams.institution_ids = userInstitutionIds;
	}
	// Pass corpus filter separately so facets respect the corpus boundary
	if (corpusInstitutionIds) {
		searchParams.corpus_institution_ids = corpusInstitutionIds;
	}

	// Research field filters: corpus + user (AND)
	const corpusResearchFieldFilters = storedFilters.researchFieldFilters || [];
	const userResearchFieldFilters = queryParams.researchFieldFilters || [];
	const combinedResearchFieldFilters = [...corpusResearchFieldFilters, ...userResearchFieldFilters];
	if (combinedResearchFieldFilters.length) {
		searchParams.researchFieldFilters = combinedResearchFieldFilters;
	}
	if (corpusResearchFieldFilters.length) {
		searchParams.corpus_researchFieldFilters = corpusResearchFieldFilters;
	}

	// Excluded objects from settings (corpus definition)
	if (storedFilters.excludeObjectIds?.length) {
		searchParams.excluded_object_ids = storedFilters.excludeObjectIds;
	}

	console.log('[WebsitePreview] Final searchParams:', searchParams);
	const searchResult = await searchObjects(searchParams);
	console.log('[WebsitePreview] Search result:', { totalCount: searchResult.totalCount, itemsCount: searchResult.items?.length });

	return {
		searchResult,
		queryParams
	};
}