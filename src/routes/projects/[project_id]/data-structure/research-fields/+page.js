import { browser } from '$app/environment';
import { getResearchFields } from '$lib/stores/ResearchFieldsUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends }) {
    if (!browser) return
    const projectId = params.project_id;
    const researchFieldsResponse = await getResearchFields(projectId);

    // Filter to only include non-vocabulary fields (free text)
    const filteredFields = (researchFieldsResponse.result || []).filter(
        (field) => (field.type || '').toLowerCase() !== 'vocabulary'
    );

    return {
        researchFields: filteredFields,
    };
} 