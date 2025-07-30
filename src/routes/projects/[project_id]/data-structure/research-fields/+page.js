import { browser } from '$app/environment';
import { getResearchFields } from '$lib/stores/ResearchFieldsUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends }) {
    if (!browser) return
    const projectId = params.project_id;
    const researchFieldsResponse = await getResearchFields(projectId);
    return {
        researchFields: researchFieldsResponse.result,
    };
} 