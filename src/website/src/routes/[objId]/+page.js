import { browser } from '$app/environment';
import { resolveProjectId, setStoredProjectId } from '$lib/utils/projectContext.js';
import { resolveSitePath } from '$lib/utils/sitePaths.js';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
const sameId = (left, right) => String(left) === String(right);

// Empty result template
const emptyResult = {
    object: null, assets: [], objectOntologyFields: [], objectResearchFields: [],
    datasources: [], institution: null, ontology_fields: [], research_fields: [],
    vocabularies: [], queryParams: { projectId: null, backHref: null }
};

/** @type {import('./$types').PageLoad} */
export async function load({ params, url, fetch }) {
    const objId = params.objId;
    const backHref = url.searchParams.get('back') || null;

    if (isStaticExport) {
        if (!browser) {
            return emptyResult;
        }

        try {
            const response = await fetch(resolveSitePath('data.json'));
            if (!response.ok) {
                throw new Error(`Failed to fetch data.json: ${response.status}`);
            }
            const data = await response.json();
            const obj = data.objects?.find(o => sameId(o.id, objId));
            
            if (!obj) return emptyResult;

            const visibleOntologyIds = new Set((data.ontology_fields || []).map(f => f.id));
            const visibleResearchIds = new Set((data.research_fields || []).map(f => f.id));

            // Strip hidden field values from the object
            obj.objectOntologyFields = (obj.objectOntologyFields || []).filter(f => visibleOntologyIds.has(f.field_id));
            obj.objectResearchFields = (obj.objectResearchFields || []).filter(f => visibleResearchIds.has(f.field_id));

            const pick = (arr, ids, mapper) => (arr || []).filter(x => ids.has(x.id)).map(mapper);
            const usedIds = {
                ontology: new Set((obj.objectOntologyFields || []).map(f => f.field_id)),
                research: new Set((obj.objectResearchFields || []).map(f => f.field_id)),
                vocab: new Set((obj.objectResearchFields || []).map(f => f.vocabulary_id).filter(Boolean)),
                datasource: new Set((obj.objectOntologyFields || []).map(f => f.datasources_id).filter(Boolean))
            };
            
            return {
                queryParams: { projectId: obj.project_id, backHref },
                object: { id: obj.id, name: obj.name, name_i18n: obj.name_i18n || null, project_id: obj.project_id, institution_id: obj.institution_id },
                assets: (obj.assets || []).map(a => ({ asset_path: a.asset_path, asset_formats: a.asset_formats, asset_type: a.asset_type, order: a.order })),
                objectOntologyFields: (obj.objectOntologyFields || []).map(f => ({ id: f.id, field_id: f.field_id, value: f.value, primary: f.primary, datasources_id: f.datasources_id, label: f.label })),
                objectResearchFields: (obj.objectResearchFields || []).map(f => ({ field_id: f.field_id, vocabulary_id: f.vocabulary_id, value: f.value })),
                datasources: (obj.datasources || []).filter(ds => usedIds.datasource.has(ds.id)).map(ds => ({ id: ds.id, name: ds.name, name_i18n: ds.name_i18n || null, method: ds.method, method_i18n: ds.method_i18n || null, institution: ds.institution?.name ? { name: ds.institution.name, name_i18n: ds.institution.name_i18n || null } : null })),
                institution: obj.institution ? { id: obj.institution.id, name: obj.institution.name, name_i18n: obj.institution.name_i18n || null, description: obj.institution.description, description_i18n: obj.institution.description_i18n || null, country: obj.institution.country, country_i18n: obj.institution.country_i18n || null, location: obj.institution.location, location_i18n: obj.institution.location_i18n || null, website: obj.institution.website } : null,
                ontology_fields: pick(data.ontology_fields, usedIds.ontology, f => ({ id: f.id, name: f.name, name_i18n: f.name_i18n || null })),
                research_fields: pick(data.research_fields, usedIds.research, f => ({ id: f.id, name: f.name, name_i18n: f.name_i18n || null, type: f.type, description: f.description, description_i18n: f.description_i18n || null })),
                vocabularies: pick(data.vocabularies, usedIds.vocab, v => ({ id: v.id, name: v.name, name_i18n: v.name_i18n || null, description: v.description, description_i18n: v.description_i18n || null, main_asset_path: v.main_asset_path })),
                project: data.project ? { name: data.project.name, name_i18n: data.project.name_i18n || null } : {},
                settings: data.settings ? { title: data.settings.title, title_i18n: data.settings.title_i18n || null } : {}
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

    return { queryParams: { projectId: resolvedProjectId, backHref }, ...result };
}
