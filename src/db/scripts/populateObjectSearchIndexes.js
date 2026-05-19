/**
 * Search index population scripts — back-fill FTS5 virtual tables when they are
 * empty but the source tables already have data. Intended to run once at startup;
 * ongoing changes are handled by SQLite triggers.
 *
 * @namespace db.scripts
 * @memberOf db
 */
import { populateObjectsSearchIndex } from './populateObjectsSearch.js';
import { populateObjectsOntologyFieldsSearchIndex } from './populateObjectsOntologyFieldsSearch.js';
import { populateObjectsResearchFieldsSearchIndex } from './populateObjectsResearchFieldsSearch.js';

/**
 * Populates all object-related FTS indices used by object search
 * @memberOf db.scripts
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