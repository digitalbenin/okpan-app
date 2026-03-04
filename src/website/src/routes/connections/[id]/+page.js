import { browser } from '$app/environment';
import { resolveProjectId } from '$lib/utils/projectContext.js';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

/** @type {import('./$types').PageLoad} */
export async function load({ params, url, fetch }) {
    const connectionId = params.id;
    
    // Static export mode
    if (isStaticExport) {
        if (!browser) {
            return { researchField: null, vocabularies: [] };
        }
        
        // Client-side: fetch data.json
        try {
            const res = await fetch('/data.json');
            if (!res.ok) {
                throw new Error(`Failed to fetch data.json: ${res.status}`);
            }
            const data = await res.json();
            const researchField = data.research_fields?.find(f => f.id === connectionId);
            const vocabularies = data.vocabularies?.filter(v => v.field_id === connectionId) || [];

            return {
                researchField,
                vocabularies
            };
        } catch (e) {
            console.error('Failed to load connection data:', e);
            return { researchField: null, vocabularies: [] };
        }
    }

    // Development / Preview mode (SQLite)
    if (!browser) return {}; // SSR in dev provided by layout/hooks usually, but here we load in client

    const { getDb, initClientDb, fetchResearchFields, fetchVocabularies } = await import('$lib/utils/dbUtils.js');
    
    let db = getDb();
    if (!db) {
        await initClientDb();
        db = getDb();
    }
    // getDb returns a promise, so await it
    db = await db;
    
    const projectId = resolveProjectId(url);
    
    // Fetch all and filter, or fetch specific? dbUtils has fetchResearchFields(db, projectId)
    // We can filter the result.
    const allFields = fetchResearchFields(db, projectId);
    const researchField = allFields.find(f => f.id === connectionId);
    
    const allVocabs = fetchVocabularies(db, projectId);
    const vocabularies = allVocabs.filter(v => v.field_id === connectionId);

    return {
        researchField,
        vocabularies,
        queryParams: { projectId }
    };
}
