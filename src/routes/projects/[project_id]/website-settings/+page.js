import { browser } from '$app/environment';
import { getWebsiteSettings } from '$lib/stores/WebsiteSettingsUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
    // Ensure server-side load returns a valid object
    if (!browser) return { websiteSettings: [] };

    const projectId = params.project_id;

    try {
        const response = await getWebsiteSettings(projectId);
        // Optional chaining to avoid undefined access; default to empty array
        const settings = response?.result ?? [];
        return { websiteSettings: settings };
    } catch (error) {
        console.error('Failed to load website settings:', error);
        return { websiteSettings: [] };
    }
}