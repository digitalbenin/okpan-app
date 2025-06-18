import { sql, eq, aliasedTable, or } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql';
import * as dbSchema from '../schema';

export const createEntitySearchQuery = (db, drizzleResult) => {
    // Define the search result type
    const EntitySearchResult = new GraphQLObjectType({
        name: 'EntitySearchResult',
        fields: () => ({
            type: { type: GraphQLString }, // 'institution', 'asset', or 'object'
            id: { type: GraphQLString },
            title: { type: GraphQLString }, // The matched text
            subtitle: { type: GraphQLString }, // Additional context
            project_id: { type: GraphQLString },
            institution_id: { type: GraphQLString }
        })
    });

    // Define the payload type
    const EntitySearchPayload = new GraphQLObjectType({
        name: 'EntitySearchPayload',
        fields: () => ({
            results: { type: new GraphQLList(new GraphQLNonNull(EntitySearchResult)) }
        })
    });

    // Add the types to the schema
    drizzleResult.schema._typeMap.EntitySearchResult = EntitySearchResult;
    drizzleResult.schema._typeMap.EntitySearchPayload = EntitySearchPayload;

    return {
        name: 'entitySearch',
        type: EntitySearchPayload,
        args: [
            {
                name: 'query',
                type: new GraphQLNonNull(GraphQLString),
                description: 'Search term to find entities'
            },
            {
                name: 'project_id',
                type: GraphQLString,
                description: 'Optional project ID to filter results'
            },
            {
                name: 'limit',
                type: drizzleResult.schema._typeMap.Int,
                description: 'Maximum number of results to return',
                defaultValue: 50
            }
        ],
        resolve: async (source, args, context, info) => {
            const { query: searchTerm, project_id, limit } = args;
            const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
            const results = [];

            // 1. Search institutions by name
            const institutionNameTexts = aliasedTable(dbSchema.texts, 'institution_name_texts');
            const institutionsQuery = db.select({
                type: sql`'institution'`.as('type'),
                id: dbSchema.institutions.id,
                title: institutionNameTexts.content,
                subtitle: sql`'Institution'`.as('subtitle'),
                project_id: dbSchema.institutions.project_id,
                institution_id: dbSchema.institutions.id
            })
                .from(dbSchema.institutions)
                .leftJoin(institutionNameTexts, eq(dbSchema.institutions.name_id, institutionNameTexts.id))
                .where(
                    sql.join([
                        sql`lower(${institutionNameTexts.content}) LIKE ${searchPattern}`,
                        project_id ? eq(dbSchema.institutions.project_id, project_id) : sql`1=1`
                    ], sql` AND `)
                )
                .limit(Math.floor(limit / 3));

            // 2. Search assets by filename
            const assetsQuery = db.select({
                type: sql`'asset'`.as('type'),
                id: dbSchema.assets.id,
                title: dbSchema.assets.filename,
                subtitle: dbSchema.assets.type,
                project_id: dbSchema.assets.project_id,
                institution_id: dbSchema.assets.institution_id
            })
                .from(dbSchema.assets)
                .where(
                    sql.join([
                        sql`lower(${dbSchema.assets.filename}) LIKE ${searchPattern}`,
                        project_id ? eq(dbSchema.assets.project_id, project_id) : sql`1=1`
                    ], sql` AND `)
                )
                .limit(Math.floor(limit / 3));

            // 3. Search objects by primary ontology fields
            const ontologyFieldTexts = aliasedTable(dbSchema.texts, 'ontology_field_texts');
            const objectsQuery = db.select({
                type: sql`'object'`.as('type'),
                id: dbSchema.objects.id,
                title: dbSchema.objects_ontology_fields.value,
                subtitle: ontologyFieldTexts.content, // The ontology field name
                project_id: dbSchema.objects.project_id,
                institution_id: dbSchema.objects.institution_id
            })
                .from(dbSchema.objects)
                .innerJoin(dbSchema.objects_ontology_fields, eq(dbSchema.objects.id, dbSchema.objects_ontology_fields.object_id))
                .leftJoin(dbSchema.ontology_fields, eq(dbSchema.objects_ontology_fields.field_id, dbSchema.ontology_fields.id))
                .leftJoin(ontologyFieldTexts, eq(dbSchema.ontology_fields.name_id, ontologyFieldTexts.id))
                .where(
                    sql.join([
                        sql`lower(${dbSchema.objects_ontology_fields.value}) LIKE ${searchPattern}`,
                        sql`${dbSchema.objects_ontology_fields.primary} = 1`,
                        project_id ? eq(dbSchema.objects.project_id, project_id) : sql`1=1`
                    ], sql` AND `)
                )
                .limit(Math.floor(limit / 3));

            try {
                // Execute all queries in parallel
                const [institutionResults, assetResults, objectResults] = await Promise.all([
                    institutionsQuery.execute(),
                    assetsQuery.execute(),
                    objectsQuery.execute()
                ]);

                // Combine results
                results.push(...institutionResults);
                results.push(...assetResults);
                results.push(...objectResults);

                // Sort by relevance (exact matches first, then by length)
                results.sort((a, b) => {
                    const aExact = a.title?.toLowerCase() === searchTerm.toLowerCase();
                    const bExact = b.title?.toLowerCase() === searchTerm.toLowerCase();

                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;

                    // Then by title length (shorter = more relevant)
                    return (a.title?.length || 0) - (b.title?.length || 0);
                });

                // Limit final results
                return {
                    results: results.slice(0, limit)
                };

            } catch (error) {
                console.error('Error in entitySearch:', error);
                return {
                    results: []
                };
            }
        }
    };
}; 