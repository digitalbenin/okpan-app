import { browser } from '$app/environment';
import { getDb, fetchObjectById } from '$lib/utils/dbUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, url }) {
    // Do not run client-DB queries on the server
    if (!browser) {
        return { object: null, assets: [], ontologyFields: [], researchFields: [], datasources: [], queryParams: { projectId: url.searchParams.get('project_id') } };
    }

    const db = await getDb();
    if (!db) {
        throw new Error('Client DB not initialized. Make sure it is initialized in the root layout before using this page loader.');
    }

    const objId = params.objId;
    const projectId = url.searchParams.get('project_id');

    // Subqueries with minimal joins to avoid duplicating data already available from +layout.js
    // (We only return IDs needed to reconcile with global lists in +layout.js.)
    const { object, assets, objectOntologyFields, objectResearchFields, datasources } = fetchObjectById(db, objId);

    return {
        queryParams: { projectId },
        object,
        assets,
        objectOntologyFields,
        objectResearchFields,
        datasources
    };
}