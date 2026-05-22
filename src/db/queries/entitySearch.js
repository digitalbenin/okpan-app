/**
 * Custom GraphQL resolver factories for entitySearch related database queries and mutations.
 *
 * @namespace db.customQueries.entitySearch
 */
import { sql, eq, aliasedTable, or } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql';
import * as dbSchema from '../schema.js';

export const createEntitySearchQuery = (db, drizzleResult) => {
    // Define the search result type
    const EntitySearchResult = new GraphQLObjectType({
        name: 'EntitySearchResult',
        fields: () => ({
            type: { type: GraphQLString }, // 'institution', 'asset', or 'object'
            id: { type: GraphQLString },
            name: { type: GraphQLString },
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
                name: 'entity_types',
                type: new GraphQLList(GraphQLString),
                description: 'Optional array of entity types to filter by (institutions, assets, objects). If not provided, all types are searched.'
            },
            {
                name: 'limit',
                type: drizzleResult.schema._typeMap.Int,
                description: 'Maximum number of results to return',
                defaultValue: 50
            }
        ],
        resolve: async (source, args, context, info) => {
            const { query: searchTerm, project_id, entity_types, limit } = args;
            const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
            const results = [];

            // Parse entity_types input - handle both string and array formats
            const parseEntityTypes = (input) => {
                if (!input) return [];

                if (typeof input === 'string') {
                    return input.trim() ? input.split(',').map(s => s.trim()).filter(Boolean) : [];
                }

                if (Array.isArray(input)) {
                    return input.flatMap(item => {
                        if (!item || typeof item !== 'string') return [];
                        const trimmed = item.trim();
                        if (!trimmed) return [];

                        // Handle JSON-like strings
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                            try {
                                const parsed = JSON.parse(trimmed);
                                return Array.isArray(parsed) ? parsed.filter(p => p && p.trim()) : [trimmed];
                            } catch { return [trimmed]; }
                        }

                        // Handle comma-separated strings
                        return trimmed.includes(',')
                            ? trimmed.split(',').map(s => s.trim()).filter(Boolean)
                            : [trimmed];
                    });
                }

                return [];
            };

            const parsedEntityTypes = parseEntityTypes(entity_types);
            const typesToSearch = parsedEntityTypes.length > 0 ? parsedEntityTypes : ['institutions', 'assets', 'objects'];

            // Calculate limit per type
            const limitPerType = Math.floor(limit / typesToSearch.length);
            const queries = [];

            // 1. Search institutions by name (if requested)
            if (typesToSearch.includes('institutions')) {
                const institutionNameTexts = aliasedTable(dbSchema.texts, 'institution_name_texts');
                const institutionsQuery = db.select({
                    type: sql`'institution'`.as('type'),
                    id: dbSchema.institutions.id,
                    name: institutionNameTexts.content,
                    title: institutionNameTexts.content,
                    subtitle: sql`'Institution'`.as('subtitle'),
                    project_id: dbSchema.institutions.project_id,
                    institution_id: dbSchema.institutions.id
                })
                    .from(dbSchema.institutions)
                    .leftJoin(institutionNameTexts, eq(dbSchema.institutions.name_id, institutionNameTexts.id))
                    .where(
                        sql.join([
                            // If search term is empty, include all institutions without a text filter
                            searchTerm.trim()
                                ? sql`lower(${institutionNameTexts.content}) LIKE ${searchPattern}`
                                : sql`1=1`,
                            project_id ? eq(dbSchema.institutions.project_id, project_id) : sql`1=1`
                        ], sql` AND `)
                    )
                    .limit(limitPerType);

                queries.push(institutionsQuery.execute());
            }

            // 2. Search assets by filename (if requested)
            if (typesToSearch.includes('assets')) {
                const assetsQuery = db.select({
                    type: sql`'asset'`.as('type'),
                    id: dbSchema.assets.id,
                    name: dbSchema.assets.filename,
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
                    .limit(limitPerType);

                queries.push(assetsQuery.execute());
            }

            // 3. Search objects by name and by primary ontology fields (if requested)
            if (typesToSearch.includes('objects')) {
                const ontologyFieldTexts = aliasedTable(dbSchema.texts, 'ontology_field_texts');

                // A) Search by object name only (does not require a primary ontology field)
                const objectsByNameQuery = db.select({
                    type: sql`'object'`.as('type'),
                    id: dbSchema.objects.id,
                    name: dbSchema.objects.name,
                    title: dbSchema.objects.name,
                    subtitle: sql`'Object'`.as('subtitle'),
                    project_id: dbSchema.objects.project_id,
                    institution_id: dbSchema.objects.institution_id
                })
                    .from(dbSchema.objects)
                    .where(
                        sql.join([
                            sql`lower(${dbSchema.objects.name}) LIKE ${searchPattern}`,
                            project_id ? eq(dbSchema.objects.project_id, project_id) : sql`1=1`
                        ], sql` AND `)
                    )
                    .limit(limitPerType);

                queries.push(objectsByNameQuery.execute());

                // B) Search by primary ontology field value
                const objectsByPrimaryIdentifierQuery = db.select({
                    type: sql`'object'`.as('type'),
                    id: dbSchema.objects.id,
                    name: dbSchema.objects.name,
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
                    .limit(limitPerType);

                queries.push(objectsByPrimaryIdentifierQuery.execute());
            }

            try {
                // Execute all queries in parallel
                const queryResults = await Promise.all(queries);

                // Combine results from all executed queries
                queryResults.forEach(result => {
                    results.push(...result);
                });

                // Deduplicate results by type+id
                const dedupedResults = [];
                const seen = new Set();
                for (const r of results) {
                    const key = `${r.type}:${r.id}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        dedupedResults.push(r);
                    }
                }

                // Sort by relevance (exact matches first, then by length)
                dedupedResults.sort((a, b) => {
                    const aExact = a.title?.toLowerCase() === searchTerm.toLowerCase();
                    const bExact = b.title?.toLowerCase() === searchTerm.toLowerCase();

                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;

                    // Then by title length (shorter = more relevant)
                    return (a.title?.length || 0) - (b.title?.length || 0);
                });

                // Limit final results
                return {
                    results: dedupedResults.slice(0, limit)
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
