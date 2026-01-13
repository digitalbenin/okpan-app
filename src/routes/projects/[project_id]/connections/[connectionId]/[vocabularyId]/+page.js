import { browser } from '$app/environment';
import { getResearchFieldById } from '$lib/stores/ResearchFieldsUtils.js';
import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageLoad} */
export async function load({ params, parent }) {
    if (!browser) return {};
    
    const { connectionId, vocabularyId } = params;
    
    // Validating project existence (loaded by parent layout)
    const parentData = await parent();
    
    // Fetch the research field which contains the vocabularies
    const { result: researchField, error: fetchError } = await getResearchFieldById(connectionId);
    
    if (fetchError) {
        console.error("Error loading connection type:", fetchError);
        throw error(500, fetchError);
    }
    
    if (!researchField) {
        throw error(404, 'Connection type not found');
    }
    
    // Find the specific vocabulary
    const vocabulary = researchField.vocabularies?.find(v => v.id === vocabularyId);
    
    if (!vocabulary) {
        throw error(404, 'Connection (Vocabulary) not found');
    }
    
    return {
        ...parentData,
        researchField,
        vocabulary
    };
}
