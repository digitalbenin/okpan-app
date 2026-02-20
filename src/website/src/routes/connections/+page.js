// Ensure this page is prerendered in static export
const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
export const prerender = isStaticExport || undefined;

import { browser } from '$app/environment';

export async function load({ url }) {
    if (isStaticExport) {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const dataPath = path.join(process.cwd(), 'static', 'data.json');
            
            const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
            
            const vocabularies = data.vocabularies || [];
            
            const connection_types = (data.research_fields || [])
                .filter((field) => field?.type === 'vocabulary')
                .map((field) => ({
                    id: field.id,
                    name: field.name,
                    description: field.description,
                    count: vocabularies.filter(v => v.field_id === field.id).length
                }));
                
            return { connection_types };
        } catch (e) {
            console.error('[Connections] Failed to load data.json during prerender:', e);
            return { connection_types: [] };
        }
    }

    // Preview mode: use database (client-side only)
    if (!browser) return {};

    const { getDb, initClientDb, fetchResearchFields, fetchVocabularies } = await import('$lib/utils/dbUtils.js');

    let db = getDb();
    if (!db) {
        await initClientDb();
        db = getDb();
    }
    db = await db;

    // Prefer project_id from URL; fall back to localStorage
    const projectId = url.searchParams.get('project_id') ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('preview_project_id') : null);

    const research_fields = fetchResearchFields(db, projectId);
    const vocabularies = fetchVocabularies(db, projectId);

    const connection_types = (research_fields || [])
        .filter((field) => field?.type === 'vocabulary')
        .map((field) => ({
            id: field.id,
            name: field.name,
            description: field.description,
            count: (vocabularies || []).filter(v => v.field_id === field.id).length
        }));

    return { connection_types };
}
