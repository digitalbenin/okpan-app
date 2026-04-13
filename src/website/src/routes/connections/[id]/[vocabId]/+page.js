import { browser } from '$app/environment';
import { resolveProjectId } from '$lib/utils/projectContext.js';
import { resolveSitePath } from '$lib/utils/sitePaths.js';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
const sameId = (left, right) => String(left) === String(right);

/** @type {import('./$types').PageLoad} */
export async function load({ params, url, fetch }) {
    const { id: connectionId, vocabId } = params;

    // Static export mode
    if (isStaticExport) {
        if (!browser) {
            return { researchField: null, vocabulary: null, connectedObjects: [] };
        }
        
        try {
            const res = await fetch(resolveSitePath('data.json'));
            if (!res.ok) {
                throw new Error(`Failed to fetch data.json: ${res.status}`);
            }
            const data = await res.json();
            const researchField = data.research_fields?.find(f => sameId(f.id, connectionId));
            const vocabulary = data.vocabularies?.find(v => sameId(v.id, vocabId));
            
            const connectedObjects = (data.objects || []).filter(obj => 
                (obj.objectResearchFields || []).some(orf => sameId(orf.vocabulary_id, vocabId))
            ).map(obj => ({
                id: obj.id,
                name: obj.name,
                main_image: obj.assets?.find(a => a.primary)?.path || obj.assets?.[0]?.path || null,
                institution_name: data.institutions?.find(i => i.id === obj.institution_id)?.name || 'Unknown Institution'
            }));
            
            return {
                researchField,
                vocabulary,
                connectedObjects
            };
        } catch (e) {
            console.error('Failed to load vocabulary detail data:', e);
            return { researchField: null, vocabulary: null, connectedObjects: [] };
        }
    }

    // Development / Preview mode (SQLite)
    if (!browser) return {};

    const { getDb, initClientDb, fetchResearchFields, fetchVocabularyDetails, fetchObjects } = await import('$lib/utils/dbUtils.js');
    
    let db = getDb();
    if (!db) {
        await initClientDb();
        db = getDb();
    }
    db = await db;
    
    const projectId = resolveProjectId(url);
    
    const allFields = fetchResearchFields(db, projectId);
    const researchField = allFields.find(f => sameId(f.id, connectionId));
    
    const vocabulary = fetchVocabularyDetails(db, vocabId);
    
    // Fetch connected objects
    // fetchObjects returns full objects, we can filter them specifically using SQL but current utils
    // fetchObjects is complex. Let's see if we can use a simpler query or reuse fetchObjects.
    // fetchObjects(db, projectId, { research_field_filters: [...] }) might work but it's for search.
    // Let's write a custom query here or add to dbUtils later if needed.
    // For now, let's fetch all objects and filter, or better, query IDs.
    
    // Custom query to get connected objects for this vocabulary
    const objectsQuery = db.exec(`
        SELECT o.id, o.name, i.id as institution_id, it.content as institution_name
        FROM objects o
        JOIN objects_research_fields orf ON o.id = orf.object_id
        LEFT JOIN institutions i ON o.institution_id = i.id
        LEFT JOIN texts it ON i.name_id = it.id
        WHERE orf.vocabulary_id = ?
    `, [vocabId]);
    
    // Need to get objects array
    // db.exec returns [{columns, values}]
    let connectedObjectRows = [];
    if (objectsQuery.length > 0 && objectsQuery[0].values) {
        const columns = objectsQuery[0].columns;
        connectedObjectRows = objectsQuery[0].values.map(row => {
            const obj = {};
            columns.forEach((col, index) => {
                obj[col] = row[index];
            });
            return obj;
        });
    }

    // Now we need images for these objects. 
    // This is getting N+1 if we are not careful.
    // For simplicity in dev mode, we can fetch one image per object.
    const connectedObjects = [];
    for (const obj of connectedObjectRows) {
        // Use oa."order" (quoted) because ORDER is a keyword, and select path as asset_path
        const assetsRes = db.exec(`
            SELECT a.path as asset_path
            FROM assets a
            JOIN objects_assets oa ON a.id = oa.asset_id
            WHERE oa.object_id = ?
            ORDER BY oa."order" ASC
            LIMIT 1
        `, [obj.id]);
        
        let main_image = null;
        if (assetsRes.length > 0 && assetsRes[0].values.length > 0) {
            main_image = assetsRes[0].values[0][0];
        }
        
        connectedObjects.push({
            ...obj,
            main_image
        });
    }

    return {
        researchField,
        vocabulary,
        connectedObjects,
        queryParams: { projectId }
    };
}
