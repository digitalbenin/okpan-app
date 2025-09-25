import { browser } from '$app/environment';
import { searchObjects } from '$lib/utils/searchUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
	const queryParams = {
		projectId: url.searchParams.get('project_id'),
		q: url.searchParams.get('q') || '',
		page: parseInt(url.searchParams.get('page') || '1'),
		pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
		institutionIds: url.searchParams.getAll('institutionId'),
		orderBy: url.searchParams.get('orderBy') || 'created_at',
		direction: url.searchParams.get('direction') || 'desc'
	};

	if (!browser) {
		return {
			searchResult: {
				items: [],
				totalCount: 0,
				page: 0,
				pageSize: 25,
				facets: { institution_ids: [], ontology_fields: [] }
			},
			queryParams
		};
	}

	const searchResult = await searchObjects({
		projectId: queryParams.projectId,
		q: queryParams.q,
		page: queryParams.page,
		pageSize: queryParams.pageSize,
		institutionIds: queryParams.institutionIds,
		orderBy: queryParams.orderBy,
		direction: queryParams.direction
	});

	return {
		searchResult,
		queryParams
	};
}