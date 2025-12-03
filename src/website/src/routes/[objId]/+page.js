import { browser } from '$app/environment';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

// Only export prerender in static export mode
// In preview mode, this route is purely dynamic (SPA)
export const prerender = isStaticExport || undefined;

// Generate static pages for each object in static export mode
export async function entries() {
    // Only generate entries in static export mode
    if (import.meta.env.VITE_USE_JSON !== 'true') {
        return [];
    }
    
    // Read data.json from static folder during build
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
        const dataPath = path.join(process.cwd(), 'static', 'data.json');
        const fileContent = await fs.readFile(dataPath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        // Return array of params for each object
        return data.objects.map(obj => ({ objId: obj.id }));
    } catch (error) {
        console.warn('[entries] Could not load data.json:', error.message);
        return [];
    }
}

/** @type {import('./$types').PageLoad} */
export async function load({ params, url, fetch }) {
    const objId = params.objId;
    
    // In static export mode, read data.json and extract only what this specific object needs
    // This data gets baked into the prerendered HTML - minimize data to reduce page size
    if (isStaticExport) {
        const response = await fetch('/data.json');
        const data = await response.json();
        const objData = data.objects?.find(obj => obj.id === objId);
        
        if (!objData) {
            return { 
                object: null, 
                assets: [], 
                objectOntologyFields: [], 
                objectResearchFields: [], 
                datasources: [],
                institution: null,
                ontology_fields: [],
                research_fields: [],
                vocabularies: [],
                queryParams: { projectId: null } 
            };
        }
        
        // Find the institution for this object
        const institution = objData.institution_id 
            ? data.institutions?.find(i => i.id === objData.institution_id) 
            : null;
        
        // Strip assets to only include what OpenSeadragon needs
        const minimalAssets = (objData.assets || []).map(a => ({
            asset_path: a.asset_path,
            asset_formats: a.asset_formats,
            asset_type: a.asset_type,
            order: a.order
        }));
        
        // Strip objectOntologyFields to minimal display data
        const minimalOntologyFields = (objData.objectOntologyFields || []).map(f => ({
            field_id: f.field_id,
            value: f.value,
            primary: f.primary,
            datasources_id: f.datasources_id
        }));
        
        // Strip objectResearchFields to minimal display data
        const minimalResearchFields = (objData.objectResearchFields || []).map(f => ({
            field_id: f.field_id,
            vocabulary_id: f.vocabulary_id,
            value: f.value
        }));
        
        // Get only the reference data actually used by this object
        const usedOntologyFieldIds = new Set(minimalOntologyFields.map(f => f.field_id));
        const usedResearchFieldIds = new Set(minimalResearchFields.map(f => f.field_id));
        const usedVocabIds = new Set(minimalResearchFields.map(f => f.vocabulary_id).filter(Boolean));
        const usedDatasourceIds = new Set(minimalOntologyFields.map(f => f.datasources_id).filter(Boolean));
        
        // Strip datasources to minimal data
        const minimalDatasources = (objData.datasources || [])
            .filter(ds => usedDatasourceIds.has(ds.id))
            .map(ds => ({
                id: ds.id,
                name: ds.name,
                method: ds.method,
                institution: ds.institution ? { name: ds.institution.name } : null
            }));
        
        // Minimal object - just what's needed for display
        const minimalObject = {
            id: objData.id,
            name: objData.name,
            project_id: objData.project_id,
            institution_id: objData.institution_id
        };
        
        // Minimal institution
        const minimalInstitution = institution ? {
            id: institution.id,
            name: institution.name,
            description: institution.description,
            website: institution.website
        } : null;
        
        return {
            queryParams: { projectId: objData.project_id },
            object: minimalObject,
            assets: minimalAssets,
            objectOntologyFields: minimalOntologyFields,
            objectResearchFields: minimalResearchFields,
            datasources: minimalDatasources,
            institution: minimalInstitution,
            // Only include reference data actually used by this object
            ontology_fields: (data.ontology_fields || [])
                .filter(f => usedOntologyFieldIds.has(f.id))
                .map(f => ({ id: f.id, name: f.name })),
            research_fields: (data.research_fields || [])
                .filter(f => usedResearchFieldIds.has(f.id))
                .map(f => ({ id: f.id, name: f.name })),
            vocabularies: (data.vocabularies || [])
                .filter(v => usedVocabIds.has(v.id))
                .map(v => ({ id: v.id, name: v.name })),
            project: data.project ? { name: data.project.name } : {},
            settings: data.settings ? { title: data.settings.title } : {}
        };
    }
    
    // Preview mode: use database
    // url.searchParams is available here since SSR is disabled in preview mode
    const projectIdFromUrl = url.searchParams.get('project_id');
    
    if (!browser) {
        return { object: null, assets: [], objectOntologyFields: [], objectResearchFields: [], datasources: [], queryParams: { projectId: projectIdFromUrl } };
    }

    const { getDb, fetchObjectById } = await import('$lib/utils/dbUtils.js');
    const db = await getDb();
    if (!db) {
        throw new Error('Client DB not initialized. Make sure it is initialized in the root layout before using this page loader.');
    }

    const { object, assets, objectOntologyFields, objectResearchFields, datasources } = fetchObjectById(db, objId);

    return {
        queryParams: { projectId: projectIdFromUrl },
        object,
        assets,
        objectOntologyFields,
        objectResearchFields,
        datasources
    };
}
