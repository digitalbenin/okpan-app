import { browser } from '$app/environment';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

// Homepage should NOT be prerendered in static export - it's interactive (search, filtering)
// We disable SSR so it generates a minimal shell, and data.json is loaded client-side
export const ssr = !isStaticExport;

/** @type {import('./$types').PageLoad} */
export async function load({ url, fetch }) {
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
	const queryParams = {
		projectId: url.searchParams.get('project_id'),
		q: url.searchParams.get('q') || '',
		page: parseInt(url.searchParams.get('page') || '1'),
		pageSize: parseInt(url.searchParams.get('pageSize') || url.searchParams.get('limit') || '10'),
		institutionIds: url.searchParams.getAll('institutionId'),
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
	const searchResult = await searchObjects({
		project_id: queryParams.projectId,
		q: queryParams.q,
		page: queryParams.page,
		pageSize: queryParams.pageSize,
		institution_ids: queryParams.institutionIds,
		orderBy: queryParams.orderBy,
		direction: queryParams.direction
	});

	return {
		searchResult,
		queryParams
	};
}