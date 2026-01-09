import { browser } from '$app/environment';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

export const prerender = isStaticExport || undefined;
export const csr = !isStaticExport;

// Empty result template
const emptyResult = {
    object: null, assets: [], objectOntologyFields: [], objectResearchFields: [],
    datasources: [], institution: null, ontology_fields: [], research_fields: [],
    vocabularies: [], queryParams: { projectId: null }
};

// Generate static pages for each object
export async function entries() {
    if (!isStaticExport) return [];
    
    try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'static', 'data.json'), 'utf-8'));
        return data.objects.map(obj => ({ objId: obj.id }));
    } catch (e) {
        console.warn('[entries] Could not load data.json:', e.message);
        return [];
    }
}

/** @type {import('./$types').PageLoad} */
export async function load({ params, url }) {
    const objId = params.objId;
    
    // Static export: client uses prerendered content (via data-sveltekit-reload links)
    if (isStaticExport && browser) return;
    
    // Static export: build time - read from filesystem
    if (isStaticExport) {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'static', 'data.json'), 'utf-8'));
            const obj = data.objects?.find(o => o.id === objId);
            
            if (!obj) return emptyResult;
            
            const pick = (arr, ids, mapper) => (arr || []).filter(x => ids.has(x.id)).map(mapper);
            const usedIds = {
                ontology: new Set((obj.objectOntologyFields || []).map(f => f.field_id)),
                research: new Set((obj.objectResearchFields || []).map(f => f.field_id)),
                vocab: new Set((obj.objectResearchFields || []).map(f => f.vocabulary_id).filter(Boolean)),
                datasource: new Set((obj.objectOntologyFields || []).map(f => f.datasources_id).filter(Boolean))
            };
            
            return {
                queryParams: { projectId: obj.project_id },
                object: { id: obj.id, name: obj.name, project_id: obj.project_id, institution_id: obj.institution_id },
                assets: (obj.assets || []).map(a => ({ asset_path: a.asset_path, asset_formats: a.asset_formats, asset_type: a.asset_type, order: a.order })),
                objectOntologyFields: (obj.objectOntologyFields || []).map(f => ({ id: f.id, field_id: f.field_id, value: f.value, primary: f.primary, datasources_id: f.datasources_id, label: f.label })),
                objectResearchFields: (obj.objectResearchFields || []).map(f => ({ field_id: f.field_id, vocabulary_id: f.vocabulary_id, value: f.value })),
                datasources: (obj.datasources || []).filter(ds => usedIds.datasource.has(ds.id)).map(ds => ({ id: ds.id, name: ds.name, method: ds.method, institution: ds.institution?.name ? { name: ds.institution.name } : null })),
                institution: obj.institution ? { id: obj.institution.id, name: obj.institution.name, description: obj.institution.description, website: obj.institution.website } : null,
                ontology_fields: pick(data.ontology_fields, usedIds.ontology, f => ({ id: f.id, name: f.name })),
                research_fields: pick(data.research_fields, usedIds.research, f => ({ id: f.id, name: f.name, type: f.type, description: f.description })),
                vocabularies: pick(data.vocabularies, usedIds.vocab, v => ({ id: v.id, name: v.name, description: v.description, main_asset_path: v.main_asset_path })),
                project: data.project ? { name: data.project.name } : {},
                settings: data.settings ? { title: data.settings.title } : {}
            };
        } catch (e) {
            console.warn('[objId load] Could not read data.json:', e.message);
            return emptyResult;
        }
    }
    
    // Preview mode: use database
    const projectId = url.searchParams.get('project_id');
    if (!browser) return { ...emptyResult, queryParams: { projectId } };

    const { getDb, fetchObjectById } = await import('$lib/utils/dbUtils.js');
    const db = await getDb();
    if (!db) throw new Error('Client DB not initialized');

    return { queryParams: { projectId }, ...fetchObjectById(db, objId) };
}
