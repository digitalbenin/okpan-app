import { browser } from '$app/environment';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
export const prerender = isStaticExport;

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
    const projectIdFromUrl = url.searchParams.get('project_id');
    
    // In static export mode, load from data.json
    if (isStaticExport) {
        const { loadAllData } = await import('$lib/utils/dataLoader.js');
        const allData = await loadAllData(fetch);
        const objData = allData.objects.find(obj => obj.id === objId);
        
        if (!objData) {
            return { 
                object: null, 
                assets: [], 
                objectOntologyFields: [], 
                objectResearchFields: [], 
                datasources: [], 
                institutions: allData.institutions || [],
                research_fields: allData.research_fields || [],
                ontology_fields: allData.ontology_fields || [],
                vocabularies: allData.vocabularies || [],
                queryParams: { projectId: projectIdFromUrl } 
            };
        }
        
        return {
            queryParams: { projectId: objData.project_id },
            object: objData,
            assets: objData.assets || [],
            objectOntologyFields: objData.objectOntologyFields || [],
            objectResearchFields: objData.objectResearchFields || [],
            datasources: objData.datasources || [],
            // Include global reference data for detail page
            institutions: allData.institutions || [],
            research_fields: allData.research_fields || [],
            ontology_fields: allData.ontology_fields || [],
            vocabularies: allData.vocabularies || []
        };
    }
    
    // Preview mode: use database
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
