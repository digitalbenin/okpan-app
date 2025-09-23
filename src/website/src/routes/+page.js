import { browser } from '$app/environment';
import { searchObjects } from '$lib/utils/searchUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ url }) {
	if (!browser) {
		return {
			items: [],
			totalCount: 0,
			page: 0,
			pageSize: 25,
			facets: { institution_ids: [], statuses: [], ontology_fields: [] }
		};
	}

	const params = Object.fromEntries(url.searchParams.entries());
	const results = await searchObjects(params);
	return results;
}