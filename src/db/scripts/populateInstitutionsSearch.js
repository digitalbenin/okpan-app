import { sql } from 'drizzle-orm';

/**
 * Populates the institutions_search FTS index with all current data
 * Run this after migration to initialize the search index
 * @param {Object} client - LibSQL client instance
 * @param {Object} db - Drizzle database instance
 */
export async function populateInstitutionsSearchIndex(client, db) {
    console.log('Populating institutions search index...');

    // Clear existing index
    await client.execute({ sql: "DELETE FROM institutions_search" });

    // Get all institutions with their text references
    const institutions = await db.select({
        id: sql`id`,
        name_id: sql`name_id`,
        description_id: sql`description_id`,
        country_id: sql`country_id`,
        location_id: sql`location_id`
    }).from(sql`institutions`);

    let indexedCount = 0;

    // For each institution, add its text fields to the search index
    for (const institution of institutions) {
        const textFields = [
            { field: 'name', id: institution.name_id },
            { field: 'description', id: institution.description_id },
            { field: 'country', id: institution.country_id },
            { field: 'location', id: institution.location_id }
        ];

        for (const { field, id } of textFields) {
            if (!id) continue; // Skip null text references

            // Get the original text content
            const texts = await db.select({
                content: sql`content`,
                language: sql`original_language`
            })
                .from(sql`texts`)
                .where(sql`id = ${id}`);

            if (texts.length > 0) {
                // Add main text to search index
                await client.execute({
                    sql: `INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_code) 
                          VALUES (?, ?, ?, ?, ?)`,
                    args: [institution.id, id, field, texts[0].content, texts[0].language]
                });
                indexedCount++;

                // Add translations to search index
                const translations = await db.select({
                    content: sql`content`,
                    language: sql`language_code`
                })
                    .from(sql`translations`)
                    .where(sql`text_id = ${id}`);

                for (const translation of translations) {
                    await client.execute({
                        sql: `INSERT INTO institutions_search (institution_id, text_id, field_name, content, language_code) 
                              VALUES (?, ?, ?, ?, ?)`,
                        args: [institution.id, id, field, translation.content, translation.language]
                    });
                    indexedCount++;
                }
            }
        }
    }

    console.log(`Search index populated with ${indexedCount} entries`);
}

// Example usage:
// import { db } from '../index.js';
// populateInstitutionsSearchIndex(db).catch(console.error); 