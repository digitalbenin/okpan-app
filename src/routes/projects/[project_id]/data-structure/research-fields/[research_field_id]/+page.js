import { browser } from '$app/environment';
import { getResearchFieldById } from '$lib/stores/ResearchFieldsUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends }) {
    if (!browser) return
    const fieldId = params.research_field_id;
    const researchFieldResponse = await getResearchFieldById(fieldId);
    return {
        researchField: researchFieldResponse.result,
    };
} 