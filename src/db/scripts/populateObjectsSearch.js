import { sql } from 'drizzle-orm';

/**
 * Populates the objects_search FTS index with object names
 * Run this after migration and seeding to initialize the search index
 * @param {Object} client - LibSQL client instance
 * @param {Object} db - Drizzle database instance
 */
export async function populateObjectsSearchIndex(client, db) {
    console.log('Populating objects_search index...');

    // Clear existing index
    await client.execute({ sql: "DELETE FROM objects_search" });

    // Get all objects and their names
    const objects = await db.select({
        id: sql`id`,
        name: sql`name`
    }).from(sql`objects`);

    let indexedCount = 0;

    for (const obj of objects) {
        const content = (obj.name || '').toLowerCase();
        if (!content.trim()) continue;

        await client.execute({
            sql: `INSERT INTO objects_search (object_id, content, source) VALUES (?, ?, ?)`,
            args: [obj.id, content, 'name']
        });
        indexedCount++;
    }

    console.log(`objects_search populated with ${indexedCount} entries`);
}