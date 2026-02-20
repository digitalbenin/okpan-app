import { browser } from '$app/environment';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

export const prerender = isStaticExport || undefined;

// Generate static pages for each connection type
export async function entries() {
    if (!isStaticExport) return [];
    
    try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const dataPath = path.join(process.cwd(), 'static', 'data.json');
        
        // If data.json doesn't exist yet (during build start), we might need to handle it.
        // But usually it should exist if we are running build. 
        // Note: adapter-static runs after vite build, so assets should be in place? 
        // Actually for kit prerendering, it runs *during* build. 
        // websiteExportService puts data.json in static/ BEFORE build starts.
        
        const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
        
        return (data.research_fields || [])
            .filter(rf => rf.type === 'vocabulary')
            .map(rf => ({ id: rf.id }));
            
    } catch (e) {
        console.warn('[entries] Could not load data.json for connections:', e.message);
        return [];
    }
}

/** @type {import('./$types').PageLoad} */
export async function load({ params, url }) {
    const connectionId = params.id;
    
    // Static export mode
    if (isStaticExport) {
        if (!browser) {
            // Server-side (prerender): read from fs
            try {
                const fs = await import('fs/promises');
                const path = await import('path');
                const data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'static', 'data.json'), 'utf-8'));
                
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
        
        // Client-side: fetch data.json
        const res = await fetch('/data.json');
        const data = await res.json();
        const researchField = data.research_fields?.find(f => f.id === connectionId);
        const vocabularies = data.vocabularies?.filter(v => v.field_id === connectionId) || [];
        
        return {
            researchField,
            vocabularies
        };
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
    
    const projectId = url.searchParams.get('project_id') ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('preview_project_id') : null);
    
    // Fetch all and filter, or fetch specific? dbUtils has fetchResearchFields(db, projectId)
    // We can filter the result.
    const allFields = fetchResearchFields(db, projectId);
    const researchField = allFields.find(f => f.id === connectionId);
    
    const allVocabs = fetchVocabularies(db, projectId);
    const vocabularies = allVocabs.filter(v => v.field_id === connectionId);

    return {
        researchField,
        vocabularies
    };
}
