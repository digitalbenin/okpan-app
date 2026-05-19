/**
 * Populates the objects_search FTS index with object names.
 * Run once at startup to back-fill the index when the source table has data
 * but the FTS index is empty. Ongoing changes are handled by SQLite triggers.
 * @memberOf db.scripts
 * @param {Object} client - LibSQL client instance
 * @param {Object} db - Drizzle database instance
 */
export async function populateObjectsSearchIndex(client, db) {
    console.log('Populating objects_search index...');

    await client.execute('DELETE FROM objects_search');

    await client.execute(`
        INSERT INTO objects_search (object_id, content, source)
        SELECT id, LOWER(COALESCE(name, '')), 'name'
        FROM objects
        WHERE TRIM(LOWER(COALESCE(name, ''))) != ''
    `);

    const { rows } = await client.execute('SELECT COUNT(*) AS count FROM objects_search');
    console.log(`objects_search populated with ${rows[0].count} entries`);
}