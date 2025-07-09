import { sql, eq } from 'drizzle-orm';
import * as dbSchema from '../schema';

export const createInstitutionsCountQuery = (db, drizzleResult) => {
    return {
        name: 'institutionsCount',
        type: drizzleResult.schema._typeMap.Int,
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter institutions by project ID'
            },
            {
                name: 'search',
                type: drizzleResult.schema._typeMap.String,
                description: 'Search term to filter institutions by name, description, country, or location'
            },
            {
                name: 'languageCode',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter search results by language code (optional)'
            },
            {
                name: 'status',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter institutions by status'
            }
        ],
        resolve: async (source, args, context, info) => {
            // Start with a basic count query
            let query = db
                .select({ count: sql`count(*)` })
                .from(dbSchema.institutions);

            // Apply project_id filter if specified
            if (args.project_id) {
                query = query.where(eq(dbSchema.institutions.project_id, args.project_id));
            }

            // Apply status filter if specified
            if (args.status) {
                query = query.where(eq(dbSchema.institutions.status, args.status));
            }

            // Apply search filter if provided
            if (args.search && args.search.trim()) {
                const searchTerm = args.search.trim();
                // Use double quotes for exact phrase matching
                const searchQuery = `content:${searchTerm}*`;

                try {
                    // If languageCode is provided, find the corresponding language_id within the project
                    let languageFilter = sql``;
                    if (args.languageCode && args.project_id) {
                        // Find the language_id for this code in the project
                        const projectLanguage = await db.select({
                            id: dbSchema.languages.id
                        })
                            .from(dbSchema.languages)
                            .where(sql`${dbSchema.languages.project_id} = ${args.project_id} AND ${dbSchema.languages.code} = ${args.languageCode}`)
                            .limit(1);

                        if (projectLanguage.length > 0) {
                            languageFilter = sql`AND s.language_id = ${projectLanguage[0].id}`;
                        }
                    }

                    // Add a WHERE condition to filter by institutions that match the search term
                    query = query.where(
                        sql`${dbSchema.institutions.id} IN (
                            SELECT s.institution_id 
                            FROM institutions_search s
                            WHERE s.institutions_search MATCH ${searchQuery}
                            ${languageFilter}
                        )`
                    );
                } catch (error) {
                    console.error('Error building FTS search for count:', error);
                    // If search fails, return zero
                    return 0;
                }
            }

            const result = await query.execute();
            return result[0].count;
        }
    };
}; 