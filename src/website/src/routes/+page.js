import { browser } from '$app/environment';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
	const queryParams = {
		projectId: url.searchParams.get('project_id'),
		q: url.searchParams.get('q') || '',
		page: parseInt(url.searchParams.get('page') || '1'),
		pageSize: parseInt(url.searchParams.get('pageSize') || url.searchParams.get('limit') || '10'),
		institutionIds: url.searchParams.getAll('institutionId'),
		orderBy: url.searchParams.get('orderBy') || 'created_at',
		direction: url.searchParams.get('direction') || 'desc'
	};

	// During SSR/prerender, return empty - actual search happens client-side
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