import { browser } from '$app/environment';
import { getResearchFields } from '$lib/stores/ResearchFieldsUtils.js';

/** @type {import('./$types').LayoutLoad} */
export async function load({ params, depends }) {
  depends('app:research-fields');
  if (!browser) return;
  const projectId = params.project_id;
  const researchFieldsResponse = await getResearchFields(projectId);
  return {
    researchFields: researchFieldsResponse.result || [],
  };
}