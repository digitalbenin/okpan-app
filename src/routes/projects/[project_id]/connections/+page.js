import { browser } from '$app/environment';
import { getResearchFields } from '$lib/api/ResearchFieldsApi.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends }) {
    if (!browser) return
    const projectId = params.project_id;
    const researchFieldsResponse = await getResearchFields(projectId);
    
    // Filter to only include vocabulary type fields
    const vocabularyFields = (researchFieldsResponse || []).filter(
        (field) => (field.type || '').toLowerCase() === 'vocabulary'
    );
    
    return {
        researchFields: vocabularyFields,
    };
} 
