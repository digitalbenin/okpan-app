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

  const projectId = url.searchParams.get('project_id');
  const ontologyQuery = url.searchParams.get('ontologyQuery') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
  const institutionIds = url.searchParams.getAll('institutionId');
  const status = url.searchParams.get('status') || '';
  const orderBy = url.searchParams.get('orderBy') || 'created_at';
  const direction = url.searchParams.get('direction') || 'desc';

  const searchResult = await searchObjects({
    projectId,
    ontologyQuery,
    page,
    pageSize,
    institutionIds,
    status,
    orderBy,
    direction
  });

  return {
    searchResult,
    queryParams: {
      projectId,
      ontologyQuery,
      page,
      pageSize,
      institutionIds,
      status,
      orderBy,
      direction
    }
  };
}