import { browser } from '$app/environment';
import { getWebsiteSettings } from '$lib/api/WebsiteSettingsApi.js';
import { searchObjects } from '$lib/api/ObjectsApi.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends }) {
    // Ensure server-side load returns a valid object
    if (!browser) return { websiteSettings: [], initialSearch: null };

    depends('app:website-settings');

    const projectId = params.project_id;

    try {
        const response = await getWebsiteSettings(projectId);
        const settings = response ?? [];
        const currentSettings = Array.isArray(settings) ? settings[0] : null;

        // Build initial search params from stored filters (same logic as +page.svelte)
        const stored = currentSettings?.filters;
        const searchOpts = { projectId, page: 0, pageSize: 10 };

        if (stored && typeof stored === 'object') {
            if (stored.status) searchOpts.status = stored.status;
            if (stored.institutionIds?.length) searchOpts.institutionIds = [...stored.institutionIds];
            if (stored.researchFieldFilters?.length) searchOpts.researchFieldFilters = [...stored.researchFieldFilters];
        }

        // Do initial search so facets are available immediately for ObjectAdvancedFilters
        let initialSearch = null;
        try {
            initialSearch = await searchObjects(searchOpts);
        } catch (e) {
            console.error('[WebsiteSettings:load] Initial search failed:', e);
        }

        return { websiteSettings: settings, initialSearch };
    } catch (error) {
        console.error('Failed to load website settings:', error);
        return { websiteSettings: [], initialSearch: null };
    }
}