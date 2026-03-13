import { browser } from '$app/environment';
import { getResearchFieldById } from '$lib/stores/ResearchFieldsUtils.js';
import { error } from '@sveltejs/kit';

function isNotFoundError(value) {
    return /not found/i.test(String(value || ''));
}

/** @type {import('./$types').PageLoad} */
export async function load({ params, parent }) {
    if (!browser) return {};
    
    const { connectionId } = params;
    const { project } = await parent();

    const response = await getResearchFieldById(connectionId);
    
    if (response.error) {
        if (isNotFoundError(response.error)) {
            return {
                project,
                researchField: null,
                missingEntity: 'connection'
            };
        }
        console.error("Error loading connection type:", response.error);
        throw error(500, response.error);
    }
    
    if (!response.result) {
        return {
            project,
            researchField: null,
            missingEntity: 'connection'
        };
    }

    return {
        researchField: response.result,
        project
    };
}
