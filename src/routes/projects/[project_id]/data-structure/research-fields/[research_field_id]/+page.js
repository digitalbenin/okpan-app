import { browser } from '$app/environment';
import { getResearchFieldById } from '$lib/api/ResearchFieldsApi.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends, parent }) {
    if (!browser) return

    // Get parent layout data (includes languages)
    const { languages } = await parent();

    const fieldId = params.research_field_id;
    const researchFieldResponse = await getResearchFieldById(fieldId);

    return {
        researchField: researchFieldResponse.result,
        languages
    };
} 