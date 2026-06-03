import { browser } from '$app/environment';
import { getResearchFields } from '$lib/api/ResearchFieldsApi.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends }) {
    depends('app:research-fields');
    if (!browser) return
    const projectId = params.project_id;
    const researchFieldsResponse = await getResearchFields(projectId);

    // Filter to only include non-vocabulary fields (free text)
    const filteredFields = (researchFieldsResponse || []).filter(
        (field) => (field.type || '').toLowerCase() !== 'vocabulary'
    );

    return {
        researchFields: filteredFields,
    };
} 