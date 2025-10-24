import { populateObjectsSearchIndex } from './populateObjectsSearch.js';
import { populateObjectsOntologyFieldsSearchIndex } from './populateObjectsOntologyFieldsSearch.js';
import { populateObjectsResearchFieldsSearchIndex } from './populateObjectsResearchFieldsSearch.js';

/**
 * Populates all object-related FTS indices used by object search
 * @param {Object} client - LibSQL client instance
 * @param {Object} db - Drizzle database instance
 */
export async function populateObjectSearchIndexes(client, db) {
    console.log('Populating all object search FTS indexes...');
    await populateObjectsSearchIndex(client, db);
    await populateObjectsOntologyFieldsSearchIndex(client, db);
    await populateObjectsResearchFieldsSearchIndex(client, db);
    console.log('All object search FTS indexes populated.');
}