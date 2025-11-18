import { sql } from 'drizzle-orm';

/**
 * Populates the objects_research_fields_search FTS index with research field values
 * @param {Object} client - LibSQL client instance
 * @param {Object} db - Drizzle database instance
 */
export async function populateObjectsResearchFieldsSearchIndex(client, db) {
    console.log('Populating objects_research_fields_search index...');

    // Clear existing index
    await client.execute({ sql: "DELETE FROM objects_research_fields_search" });

    // Get all research field values per object
    const fields = await db.select({
        orf_id: sql`id`,
        object_id: sql`object_id`,
        field_id: sql`field_id`,
        vocabulary_id: sql`vocabulary_id`,
        value: sql`value`
    }).from(sql`objects_research_fields`);

    let indexedCount = 0;

    for (const f of fields) {
        const content = (f.value || '').toLowerCase();
        if (!content.trim()) continue;

        await client.execute({
            sql: `INSERT INTO objects_research_fields_search (orf_id, object_id, field_id, vocabulary_id, content) VALUES (?, ?, ?, ?, ?)`,
            args: [f.orf_id, f.object_id, f.field_id, f.vocabulary_id, content]
        });
        indexedCount++;
    }

    console.log(`objects_research_fields_search populated with ${indexedCount} entries`);
}