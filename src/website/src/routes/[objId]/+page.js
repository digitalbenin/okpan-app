import { browser } from '$app/environment';
import { resolveProjectId, setStoredProjectId } from '$lib/utils/projectContext.js';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

// Empty result template
const emptyResult = {
    object: null, assets: [], objectOntologyFields: [], objectResearchFields: [],
    datasources: [], institution: null, ontology_fields: [], research_fields: [],
    vocabularies: [], queryParams: { projectId: null }
};

/** @type {import('./$types').PageLoad} */
export async function load({ params, url, fetch }) {
    const objId = params.objId;

    if (isStaticExport) {
        if (!browser) {
            return emptyResult;
        }

        try {
            const response = await fetch('/data.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch data.json: ${response.status}`);
            }
            const data = await response.json();
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
            console.warn('[objId load] Could not load data.json:', e.message);
            return emptyResult;
        }
    }
    
    // Preview mode: use database
    const projectId = resolveProjectId(url);
    if (!browser) return { ...emptyResult, queryParams: { projectId } };

    const { getDb, fetchObjectById } = await import('$lib/utils/dbUtils.js');
    const db = await getDb();
    if (!db) throw new Error('Client DB not initialized');

    const result = fetchObjectById(db, objId);
    const resolvedProjectId = result?.object?.project_id || projectId || null;
    if (resolvedProjectId) {
        setStoredProjectId(resolvedProjectId);
    }

    return { queryParams: { projectId: resolvedProjectId }, ...result };
}
