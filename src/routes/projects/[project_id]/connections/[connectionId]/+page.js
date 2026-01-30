import { browser } from '$app/environment';
import { getResearchFieldById } from '$lib/stores/ResearchFieldsUtils.js';
import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageLoad} */
export async function load({ params, parent }) {
    if (!browser) return {};
    
    const { connectionId } = params;
    const { project } = await parent();

    const response = await getResearchFieldById(connectionId);
    
    if (response.error) {
        console.error("Error loading connection type:", response.error);
        throw error(500, response.error);
    }
    
    if (!response.result) {
        throw error(404, 'Connection type not found');
    }

    return {
        researchField: response.result,
        project
    };
}
