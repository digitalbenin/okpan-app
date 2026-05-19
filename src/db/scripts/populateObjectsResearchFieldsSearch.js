/**
 * Populates the objects_research_fields_search FTS index with research field values.
 * Run once at startup to back-fill the index when the source table has data
 * but the FTS index is empty. Ongoing changes are handled by SQLite triggers.
 * @memberOf db.scripts
 * @param {Object} client - LibSQL client instance
 * @param {Object} db - Drizzle database instance
 */
export async function populateObjectsResearchFieldsSearchIndex(client, db) {
    console.log('Populating objects_research_fields_search index...');

    await client.execute('DELETE FROM objects_research_fields_search');

    await client.execute(`
        INSERT INTO objects_research_fields_search (orf_id, object_id, field_id, vocabulary_id, content)
        SELECT id, object_id, field_id, vocabulary_id, LOWER(COALESCE(value, ''))
        FROM objects_research_fields
        WHERE TRIM(LOWER(COALESCE(value, ''))) != ''
    `);

    const { rows } = await client.execute('SELECT COUNT(*) AS count FROM objects_research_fields_search');
    console.log(`objects_research_fields_search populated with ${rows[0].count} entries`);
}