import { sql } from 'drizzle-orm';

/**
 * Populates the objects_ontology_fields_search FTS index with ontology field values
 * @param {Object} client - LibSQL client instance
 * @param {Object} db - Drizzle database instance
 */
export async function populateObjectsOntologyFieldsSearchIndex(client, db) {
    console.log('Populating objects_ontology_fields_search index...');

    // Clear existing index
    await client.execute({ sql: "DELETE FROM objects_ontology_fields_search" });

    // Get all ontology field values per object
    const fields = await db.select({
        oof_id: sql`id`,
        object_id: sql`object_id`,
        field_id: sql`field_id`,
        value: sql`value`
    }).from(sql`objects_ontology_fields`);

    let indexedCount = 0;

    for (const f of fields) {
        const content = (f.value || '').toLowerCase();
        if (!content.trim()) continue;

        await client.execute({
            sql: `INSERT INTO objects_ontology_fields_search (oof_id, object_id, field_id, content) VALUES (?, ?, ?, ?)`,
            args: [f.oof_id, f.object_id, f.field_id, content]
        });
        indexedCount++;
    }

    console.log(`objects_ontology_fields_search populated with ${indexedCount} entries`);
}