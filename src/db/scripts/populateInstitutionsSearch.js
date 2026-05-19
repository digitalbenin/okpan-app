/**
 * Populates the institutions_search FTS index with all current data.
 * Run once at startup to back-fill the index when the source table has data
 * but the FTS index is empty. Indexes both original text and all translations
 * for the four searchable fields: name, description, country, location.
 * @memberOf db.scripts
 * @param {Object} client - LibSQL client instance
 * @param {Object} db - Drizzle database instance
 */
export async function populateInstitutionsSearchIndex(client, db) {
    console.log('Populating institutions search index...');

    await client.execute('DELETE FROM institutions_search');

    // Index original text content for all four searchable fields in one query
    await client.execute(`
        INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_id)
        SELECT i.id, t.id, 'name',        t.content, t.original_language_id FROM institutions i JOIN texts t ON t.id = i.name_id        WHERE i.name_id IS NOT NULL
        UNION ALL
        SELECT i.id, t.id, 'description', t.content, t.original_language_id FROM institutions i JOIN texts t ON t.id = i.description_id WHERE i.description_id IS NOT NULL
        UNION ALL
        SELECT i.id, t.id, 'country',     t.content, t.original_language_id FROM institutions i JOIN texts t ON t.id = i.country_id    WHERE i.country_id IS NOT NULL
        UNION ALL
        SELECT i.id, t.id, 'location',    t.content, t.original_language_id FROM institutions i JOIN texts t ON t.id = i.location_id   WHERE i.location_id IS NOT NULL
    `);

    // Index translations for all four searchable fields in one query
    await client.execute(`
        INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_id)
        SELECT i.id, tr.text_id, 'name',        tr.content, tr.language_id FROM institutions i JOIN translations tr ON tr.text_id = i.name_id        WHERE i.name_id IS NOT NULL
        UNION ALL
        SELECT i.id, tr.text_id, 'description', tr.content, tr.language_id FROM institutions i JOIN translations tr ON tr.text_id = i.description_id WHERE i.description_id IS NOT NULL
        UNION ALL
        SELECT i.id, tr.text_id, 'country',     tr.content, tr.language_id FROM institutions i JOIN translations tr ON tr.text_id = i.country_id    WHERE i.country_id IS NOT NULL
        UNION ALL
        SELECT i.id, tr.text_id, 'location',    tr.content, tr.language_id FROM institutions i JOIN translations tr ON tr.text_id = i.location_id   WHERE i.location_id IS NOT NULL
    `);

    const { rows } = await client.execute('SELECT COUNT(*) AS count FROM institutions_search');
    console.log(`institutions_search populated with ${rows[0].count} entries`);
}