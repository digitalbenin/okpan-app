import { sql, eq, aliasedTable, countDistinct, inArray, and, or } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLInt, GraphQLString } from 'graphql';
import * as dbSchema from '../schema.js';
import { buildSafeFtsAndPrefixQuery } from './common.js';

export const createObjectSearchQuery = (db, drizzleResult) => {
    // Define FacetItem type for facets
    const FacetItem = new GraphQLObjectType({
        name: 'FacetItem',
        fields: () => ({
            id: { type: GraphQLString },
            name: { type: GraphQLString },
            count: { type: GraphQLInt }
        })
    });

    // Define Facets type
    const Facets = new GraphQLObjectType({
        name: 'Facets',
        fields: () => ({
            institutions: { type: new GraphQLList(FacetItem) },
            statuses: { type: new GraphQLList(FacetItem) },
            researchFields: {
                type: new GraphQLList(new GraphQLObjectType({
                    name: 'ResearchFieldFacet',
                    fields: () => ({
                        fieldId: { type: GraphQLString },
                        fieldName: { type: GraphQLString },
                        options: { type: new GraphQLList(FacetItem) }
                    })
                }))
            }
        })
    });

    // Define ObjectSearchResult type
    const ObjectSearchResult = new GraphQLObjectType({
        name: 'ObjectSearchResult',
        fields: () => ({
            items: { type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.ObjectsSelectItem)) },
            totalCount: { type: GraphQLInt },
            facets: { type: Facets }
        })
    });

    // Add types to schema
    drizzleResult.schema._typeMap.FacetItem = FacetItem;
    drizzleResult.schema._typeMap.Facets = Facets;
    drizzleResult.schema._typeMap.ObjectSearchResult = ObjectSearchResult;



    return {
        name: 'objectSearch',
        type: ObjectSearchResult,
        args: [
            {
                name: 'project_id',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.String),
                description: 'Project ID to search within'
            },
            {
                name: 'assetId',
                type: drizzleResult.schema._typeMap.String,
                description: 'Optional asset ID to prioritize linked objects'
            },
            {
                name: 'ontologyFieldQueries',
                type: drizzleResult.schema._typeMap.JSON,
                description: 'JSON mapping or array of {fieldId, query}'
            },
            {
                name: 'genericQuery',
                type: drizzleResult.schema._typeMap.String,
                description: 'Generic text query across object name and fields'
            },
            {
                name: 'institutionIds',
                type: new GraphQLList(drizzleResult.schema._typeMap.String),
                description: 'List of institution IDs to filter by (if empty, includes all)'
            },
            {
                name: 'researchFieldFilters',
                type: new GraphQLList(drizzleResult.schema._typeMap.JSON),
                description: 'Array of research field filters: {fieldId, query?, vocabularyIds?}'
            },
            {
                name: 'status',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter objects by status'
            },
            {
                name: 'page',
                type: drizzleResult.schema._typeMap.Int,
                description: 'Page number for pagination (0-based)',
                defaultValue: 0
            },
            {
                name: 'pageSize',
                type: drizzleResult.schema._typeMap.Int,
                description: 'Number of items per page',
                defaultValue: 10
            },
            {
                name: 'orderBy',
                type: drizzleResult.schema._typeMap.String,
                description: 'Field to order by (created_at, updated_at, status, name)',
                defaultValue: 'created_at'
            },
            {
                name: 'direction',
                type: drizzleResult.schema._typeMap.String,
                description: 'Sort direction (asc or desc)',
                defaultValue: 'desc'
            },
        ],
        resolve: async (source, args, context, info) => {
            const queryStart = performance.now();
            const timings = {};
            const logTiming = (label, start) => {
                //const elapsed = ((performance.now() - start) / 1000).toFixed(3);
                //timings[label] = elapsed;
                
            };

            // Parse research field filters and clean up double-quoted strings
            const researchFieldFilters = args.researchFieldFilters ?
                args.researchFieldFilters.map(filter => {
                    let parsed = typeof filter === 'string' ? JSON.parse(filter) : filter;

                    // Clean up double-quoted strings
                    if (parsed.fieldId && typeof parsed.fieldId === 'string') {
                        parsed.fieldId = parsed.fieldId.replace(/^"(.*)"$/, '$1');
                    }
                    if (parsed.vocabularyIds && Array.isArray(parsed.vocabularyIds)) {
                        parsed.vocabularyIds = parsed.vocabularyIds.map(id =>
                            typeof id === 'string' ? id.replace(/^"(.*)"$/, '$1') : id
                        );
                    }

                    return parsed;
                }) : [];

            // Parse ontology field queries and clean up double-quoted strings
            // Supports either an array of { fieldId, query } or a JSON mapping { [fieldId]: query }
            let ontologyFieldQueries = [];
            if (args.ontologyFieldQueries) {
                let raw = args.ontologyFieldQueries;
                // If provided as a JSON string, parse first
                if (typeof raw === 'string') {
                    try { raw = JSON.parse(raw); } catch (_) { /* ignore parse errors */ }
                }
                const list = Array.isArray(raw)
                    ? raw
                    : (raw && typeof raw === 'object')
                        ? Object.entries(raw).map(([fieldId, query]) => ({ fieldId, query }))
                        : [];
                ontologyFieldQueries = list.map(item => {
                    const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                    if (parsed.fieldId && typeof parsed.fieldId === 'string') {
                        parsed.fieldId = parsed.fieldId.replace(/^"(.*)"$/, '$1');
                    }
                    if (parsed.query && typeof parsed.query === 'string') {
                        parsed.query = parsed.query.replace(/^"(.*)"$/, '$1');
                    }
                    return parsed;
                });
            }

            // Create aliases for tables (only needed for facets)
            const institutionNameTexts = aliasedTable(dbSchema.texts, 'institution_name_texts_obj_search');

            // Build ontology and research fields queries with explicit table references
            const ontologyFieldsQuery = sql`(SELECT json_group_array(json_object('id', oof.id, 'value', oof.value, 'field_id', oof.field_id, 'primary', oof."primary", 'default_description', oof.default_description, 'ontology_field_name_id', ot.name_id, 'ontology_field_name_content', ot_name_texts.content )) FROM objects_ontology_fields oof JOIN ontology_fields ot ON oof.field_id = ot.id JOIN texts ot_name_texts ON ot.name_id = ot_name_texts.id WHERE oof.object_id = objects.id)`;

            const researchFieldsQuery = sql`(SELECT json_group_array(json_object('id', orf.id, 'value', orf.value, 'field_id', orf.field_id, 'research_field_name_id', rf.name_id, 'research_field_name_content', rf_name_texts.content, 'vocabulary_id', orf.vocabulary_id, 'vocabulary_option_content', v_option_texts.content, 'vocabulary_main_asset_id', ga.id, 'vocabulary_main_asset_path', ga.path, 'vocabulary_main_asset_formats', ga.formats, 'vocabulary_main_asset_type', ga.type )) FROM objects_research_fields orf JOIN research_fields rf ON orf.field_id = rf.id JOIN texts rf_name_texts ON rf.name_id = rf_name_texts.id LEFT JOIN vocabularies v ON orf.vocabulary_id = v.id LEFT JOIN texts v_option_texts ON v.option_id = v_option_texts.id LEFT JOIN generic_assets ga ON v.main_asset_id = ga.id WHERE orf.object_id = objects.id)`;

            // Helper builders to keep condition construction DRY and precise
            // Helper to convert raw string into FTS5 AND wildcard query
            const toFtsAndQuery = (s) => buildSafeFtsAndPrefixQuery(s);

            const buildOntologyConditions = (queries) => {
                if (!queries || queries.length === 0) return [];
                const perFieldConds = queries
                    .filter(ofq => ofq && ofq.fieldId && ofq.query && ofq.query.trim())
                    .map(ofq => {
                        const fts = toFtsAndQuery(ofq.query);
                        // Use IN with subquery instead of EXISTS for better performance
                        return sql`objects.id IN (
                            SELECT oofs.object_id FROM objects_ontology_fields_search oofs
                            WHERE oofs.field_id = ${ofq.fieldId}
                            AND oofs.content MATCH ${fts}
                        )`;
                    });
                return perFieldConds.length > 0 ? [and(...perFieldConds)] : [];
            };

            const buildGenericConditions = (rawQuery) => {
                if (!rawQuery || !rawQuery.trim()) return [];
                const fts = toFtsAndQuery(rawQuery);
                // Use IN with UNION for better performance than OR with EXISTS
                const cond = sql`objects.id IN (
                    SELECT os.object_id FROM objects_search os WHERE os.content MATCH ${fts}
                    UNION
                    SELECT oofs.object_id FROM objects_ontology_fields_search oofs WHERE oofs.content MATCH ${fts}
                    UNION
                    SELECT orfs.object_id FROM objects_research_fields_search orfs WHERE orfs.content MATCH ${fts}
                )`;
                return [cond];
            };

            const buildResearchFieldConditions = (filters) => {
                if (!filters || filters.length === 0) return [];
                const researchFieldConditions = [];
                for (const filter of filters) {
                    const fieldConditions = [];
                    // Text query: use FTS table with IN instead of EXISTS
                    if (filter?.query && filter.query.trim()) {
                        const fts = toFtsAndQuery(filter.query);
                        fieldConditions.push(sql`objects.id IN (
                            SELECT orfs.object_id FROM objects_research_fields_search orfs
                            WHERE orfs.field_id = ${filter.fieldId}
                            AND orfs.content MATCH ${fts}
                        )`);
                    }
                    // Vocabulary selections: use IN instead of EXISTS
                    if (Array.isArray(filter?.vocabularyIds) && filter.vocabularyIds.length > 0) {
                        fieldConditions.push(sql`objects.id IN (
                            SELECT orf.object_id FROM objects_research_fields orf
                            WHERE orf.field_id = ${filter.fieldId}
                            AND orf.vocabulary_id IN (${sql.join(filter.vocabularyIds.map(id => sql`${id}`), sql`, `)})
                        )`);
                    }
                    if (fieldConditions.length > 0) {
                        researchFieldConditions.push(or(...fieldConditions));
                    }
                }
                return researchFieldConditions.length > 0 ? [and(...researchFieldConditions)] : [];
            };

            const buildBaseConditions = (args, { includeInstitution = true, includeStatus = true } = {}) => {
                const conds = [eq(dbSchema.objects.project_id, args.project_id)];
                if (includeInstitution && args.institutionIds && args.institutionIds.length > 0) {
                    conds.push(inArray(dbSchema.objects.institution_id, args.institutionIds));
                }
                if (includeStatus && args.status) {
                    conds.push(eq(dbSchema.objects.status, args.status));
                }
                return conds;
            };

            // Build search conditions using helpers
            const institutionFilterApplied = Boolean(args.institutionIds && args.institutionIds.length > 0);
            const statusFilterApplied = Boolean(args.status);

            const searchConditions = [
                ...buildBaseConditions(args),
                ...buildGenericConditions(args.genericQuery),
                ...buildOntologyConditions(ontologyFieldQueries),
                ...buildResearchFieldConditions(researchFieldFilters)
            ];

            // === PHASE 1: Get count and paginated IDs (fast, no JSON subqueries) ===
            const countStart = performance.now();
            
            // Count query - simple, no JSON
            let countQuery = db
                .select({ totalCount: countDistinct(dbSchema.objects.id) })
                .from(dbSchema.objects);

            if (searchConditions.length > 0) {
                countQuery = countQuery.where(sql.join(searchConditions, sql` AND `));
            }

            const countResult = await countQuery.execute();
            const totalCount = countResult[0]?.totalCount || 0;
            logTiming('1. COUNT query', countStart);

            // Get paginated IDs only (no JSON subqueries)
            const idsStart = performance.now();
            let orderByField;
            const direction = args.direction === 'asc' ? sql` ASC` : sql` DESC`;
            switch (args.orderBy) {
                case 'updated_at': orderByField = dbSchema.objects.updated_at; break;
                case 'status': orderByField = dbSchema.objects.status; break;
                case 'name': orderByField = sql`lower(${dbSchema.objects.name})`; break;
                case 'created_at': default: orderByField = dbSchema.objects.created_at; break;
            }

            const linkedOrderExpr = args.assetId
                ? sql`CASE WHEN objects.id IN (SELECT oa.object_id FROM objects_assets oa WHERE oa.asset_id = ${args.assetId}) THEN 0 ELSE 1 END`
                : null;

            const orderClauses = [];
            if (linkedOrderExpr) {
                orderClauses.push(linkedOrderExpr);
            }
            orderClauses.push(sql`${orderByField}${direction}`);

            // Get just the IDs for the current page (fast)
            let idsQuery = db
                .select({ id: dbSchema.objects.id })
                .from(dbSchema.objects);

            if (searchConditions.length > 0) {
                idsQuery = idsQuery.where(sql.join(searchConditions, sql` AND `));
            }

            idsQuery = idsQuery
                .orderBy(...orderClauses)
                .limit(args.pageSize)
                .offset(args.page * args.pageSize);

            const idsResult = await idsQuery.execute();
            const pageIds = idsResult.map(r => r.id);
            logTiming('2. GET PAGE IDs query', idsStart);

            // === PHASE 2: Fetch full data only for the paginated IDs ===
            const mainResultsStart = performance.now();
            let rawResults = [];
            
            if (pageIds.length > 0) {
                // Build base query with JSON subqueries - but only for the specific IDs
                const baseSelect = {
                    id: dbSchema.objects.id,
                    name: dbSchema.objects.name,
                    created_at: dbSchema.objects.created_at,
                    updated_at: dbSchema.objects.updated_at,
                    status: dbSchema.objects.status,
                    institution_id: dbSchema.objects.institution_id,
                    project_id: dbSchema.objects.project_id,
                    institution_json: sql`(SELECT json_object(
                        'id', inst.id,
                        'name', json_object('content', inst_name_texts.content)
                    ) FROM institutions inst LEFT JOIN texts inst_name_texts ON inst.name_id = inst_name_texts.id WHERE inst.id = objects.institution_id)`.as('institution_json'),
                    objects_assets_json: sql`(SELECT json_group_array(json_object('order', oa."order", 'asset_id', oa.asset_id, 'asset_filename', a.filename, 'asset_formats', a.formats, 'asset_path', a.path, 'asset_type', a.type, 'asset_real_id', a.id)) FROM objects_assets oa JOIN assets a ON oa.asset_id = a.id WHERE oa.object_id = objects.id)`.as('objects_assets_json'),
                    objects_ontology_fields_json: ontologyFieldsQuery.as('objects_ontology_fields_json'),
                    objects_research_fields_json: researchFieldsQuery.as('objects_research_fields_json'),
                };

                // Fetch full data only for these IDs (small set, JSON subqueries are acceptable)
                const fullDataQuery = db
                    .select(baseSelect)
                    .from(dbSchema.objects)
                    .where(inArray(dbSchema.objects.id, pageIds));

                const fullResults = await fullDataQuery.execute();
                
                // Restore original order (IN clause doesn't preserve order)
                const resultsMap = new Map(fullResults.map(r => [r.id, r]));
                rawResults = pageIds.map(id => resultsMap.get(id)).filter(Boolean);
            }
            logTiming('3. FETCH FULL DATA for page', mainResultsStart);

            // Build facets - run ALL facet queries in PARALLEL for performance
            const facetsStart = performance.now();
            const facets = { institutions: [], researchFields: [], statuses: [] };

            // Prepare conditions for each facet type
            let nonInstitutionConditions;
            if (institutionFilterApplied) {
                nonInstitutionConditions = [
                    ...buildBaseConditions(args, { includeInstitution: false }),
                    ...buildGenericConditions(args.genericQuery),
                    ...buildOntologyConditions(ontologyFieldQueries),
                    ...buildResearchFieldConditions(researchFieldFilters)
                ];
            } else {
                nonInstitutionConditions = searchConditions;
            }

            let nonStatusConditions;
            if (statusFilterApplied) {
                nonStatusConditions = [
                    ...buildBaseConditions(args, { includeStatus: false }),
                    ...buildGenericConditions(args.genericQuery),
                    ...buildOntologyConditions(ontologyFieldQueries),
                    ...buildResearchFieldConditions(researchFieldFilters)
                ];
            } else {
                nonStatusConditions = searchConditions;
            }

            const nonResearchFieldConditions = [
                ...buildBaseConditions(args),
                ...buildGenericConditions(args.genericQuery),
                ...buildOntologyConditions(ontologyFieldQueries)
            ];

            // === Run all base facet queries in parallel ===
            const baseFacetsStart = performance.now();
            const [allInstitutions, institutionCounts, vocabularyFields, statusCounts] = await Promise.all([
                // 1. Get ALL institutions for this project
                db.select({
                    id: dbSchema.institutions.id,
                    name: institutionNameTexts.content
                })
                .from(dbSchema.institutions)
                .leftJoin(institutionNameTexts, eq(dbSchema.institutions.name_id, institutionNameTexts.id))
                .where(eq(dbSchema.institutions.project_id, args.project_id))
                .execute(),

                // 2. Get counts per institution with non-institution filters applied
                (async () => {
                    let q = db.select({
                        institution_id: dbSchema.objects.institution_id,
                        count: countDistinct(dbSchema.objects.id)
                    })
                    .from(dbSchema.objects)
                    .groupBy(dbSchema.objects.institution_id);
                    if (nonInstitutionConditions.length > 0) {
                        q = q.where(sql.join(nonInstitutionConditions, sql` AND `));
                    }
                    return q.execute();
                })(),

                // 3. Get vocabulary fields for research field facets
                (async () => {
                    const rfNameTexts = aliasedTable(dbSchema.texts, 'rf_name_texts_facet');
                    return db.select({
                        id: dbSchema.research_fields.id,
                        name: rfNameTexts.content
                    })
                    .from(dbSchema.research_fields)
                    .leftJoin(rfNameTexts, eq(dbSchema.research_fields.name_id, rfNameTexts.id))
                    .where(and(
                        eq(dbSchema.research_fields.project_id, args.project_id),
                        eq(dbSchema.research_fields.type, 'vocabulary')
                    ))
                    .execute();
                })(),

                // 4. Get counts per status with non-status filters applied
                (async () => {
                    let q = db.select({
                        status: dbSchema.objects.status,
                        count: countDistinct(dbSchema.objects.id)
                    })
                    .from(dbSchema.objects)
                    .groupBy(dbSchema.objects.status);
                    if (nonStatusConditions.length > 0) {
                        q = q.where(sql.join(nonStatusConditions, sql` AND `));
                    }
                    return q.execute();
                })()
            ]);
            logTiming('3. BASE FACETS (institutions, status, vocabFields) parallel', baseFacetsStart);

            // Build institution facets
            const institutionCountMap = new Map(institutionCounts.map(ic => [ic.institution_id, ic.count]));
            facets.institutions = allInstitutions.map(inst => ({
                id: inst.id,
                name: inst.name,
                count: institutionCountMap.get(inst.id) || 0
            }));

            // Build status facets
            facets.statuses = statusCounts.map(sc => ({
                id: sc.status,
                name: sc.status,
                count: sc.count
            }));

            // Process all vocabulary fields in PARALLEL using Promise.all
            const vocabFacetsStart = performance.now();
            
            const vocabularyFacetPromises = vocabularyFields.map(async (field) => {
                const fieldStart = performance.now();
                // Get ALL vocabulary options for this research field
                const vOptionTextsAll = aliasedTable(dbSchema.texts, `v_option_texts_all_${field.id.replace(/-/g, '_')}`);
                const allVocabularyOptions = await db
                    .select({
                        id: dbSchema.vocabularies.id,
                        name: vOptionTextsAll.content
                    })
                    .from(dbSchema.vocabularies)
                    .leftJoin(vOptionTextsAll, eq(dbSchema.vocabularies.option_id, vOptionTextsAll.id))
                    .where(eq(dbSchema.vocabularies.field_id, field.id))
                    .execute();

                // Build the WHERE clause without any research field filters
                const baseConditions = [
                    eq(dbSchema.objects_research_fields.field_id, field.id),
                    sql`${dbSchema.objects_research_fields.vocabulary_id} IS NOT NULL`
                ];

                let vocabularyCountQuery = db
                    .select({
                        vocabulary_id: dbSchema.objects_research_fields.vocabulary_id,
                        count: countDistinct(dbSchema.objects.id)
                    })
                    .from(dbSchema.objects)
                    .leftJoin(dbSchema.objects_research_fields, eq(dbSchema.objects.id, dbSchema.objects_research_fields.object_id))
                    .groupBy(dbSchema.objects_research_fields.vocabulary_id);

                const allConditions = [...nonResearchFieldConditions, ...baseConditions];
                if (allConditions.length > 0) {
                    vocabularyCountQuery = vocabularyCountQuery.where(sql.join(allConditions, sql` AND `));
                }

                const vocabularyCounts = await vocabularyCountQuery.execute();
                

                // Create a map for quick lookup
                const vocabCountMap = new Map(vocabularyCounts.map(vc => [vc.vocabulary_id, vc.count]));

                // Combine all vocabulary options with their counts (0 if not found)
                const vocabularyFacetResults = allVocabularyOptions.map(vocab => ({
                    id: vocab.id,
                    name: vocab.name,
                    count: vocabCountMap.get(vocab.id) || 0
                }));

                return {
                    fieldId: field.id,
                    fieldName: field.name,
                    options: vocabularyFacetResults
                };
            });

            facets.researchFields = await Promise.all(vocabularyFacetPromises);
            logTiming('4. VOCABULARY FACETS (all fields parallel)', vocabFacetsStart);
            logTiming('TOTAL FACETS TIME', facetsStart);

            // Process results
            const processStart = performance.now();
            const processedItems = rawResults.map(item => {
                // Institution parsing
                let institution = null;
                if (item.institution_json) {
                    try {
                        const parsedInst = JSON.parse(item.institution_json);
                        if (parsedInst && parsedInst.id) {
                            institution = {
                                id: parsedInst.id,
                                name: { content: parsedInst?.name?.content }
                            };
                        }
                    } catch (e) { console.error('Error parsing institution_json:', e); }
                }

                let objectsAssets = [];
                if (item.objects_assets_json) {
                    try {
                        const parsedAssets = JSON.parse(item.objects_assets_json);
                        objectsAssets = parsedAssets.map(oa => ({
                            order: oa.order,
                            asset: {
                                id: oa.asset_real_id,
                                filename: oa.asset_filename,
                                formats: typeof oa.asset_formats === 'string' ? JSON.parse(oa.asset_formats || '{}') : (oa.asset_formats || {}),
                                path: oa.asset_path,
                                type: oa.asset_type
                            }
                        })).filter(oa => oa.asset.id != null);
                    } catch (e) { console.error('Error parsing objects_assets_json:', e); }
                }

                let objectsOntologyFields = [];
                if (item.objects_ontology_fields_json) {
                    try {
                        const parsedFields = JSON.parse(item.objects_ontology_fields_json);
                        objectsOntologyFields = parsedFields.map(oof => ({
                            id: oof.id,
                            value: oof.value,
                            primary: oof.primary,
                            default_description: oof.default_description,
                            ontologyField: {
                                id: oof.field_id,
                                name: { content: oof.ontology_field_name_content }
                            }
                        })).filter(oof => oof.id != null);
                    } catch (e) { console.error('Error parsing objects_ontology_fields_json:', e); }
                }

                let objectsResearchFields = [];
                if (item.objects_research_fields_json) {
                    try {
                        const parsedFields = JSON.parse(item.objects_research_fields_json);
                        objectsResearchFields = parsedFields.map(orf => {
                            const result = {
                                id: orf.id,
                                value: orf.value,
                                vocabulary_id: orf.vocabulary_id,
                                researchField: {
                                    id: orf.field_id,
                                    name: { content: orf.research_field_name_content }
                                }
                            };

                            if (orf.vocabulary_id && orf.vocabulary_option_content) {
                                result.vocabulary = {
                                    id: orf.vocabulary_id,
                                    option: { content: orf.vocabulary_option_content }
                                };

                                if (orf.vocabulary_main_asset_id || orf.vocabulary_main_asset_path) {
                                    result.vocabulary.mainAsset = {
                                        id: orf.vocabulary_main_asset_id,
                                        path: orf.vocabulary_main_asset_path,
                                        formats: orf.vocabulary_main_asset_formats,
                                        type: orf.vocabulary_main_asset_type,
                                    };
                                }
                            }

                            return result;
                        }).filter(orf => orf.id != null);
                    } catch (e) { console.error('Error parsing objects_research_fields_json:', e); }
                }

                return {
                    id: item.id,
                    name: item.name,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                    status: item.status,
                    institution_id: item.institution_id,
                    institution: institution,
                    project_id: item.project_id,
                    objectsAssets: objectsAssets,
                    objectsOntologyFields: objectsOntologyFields,
                    objectsResearchFields: objectsResearchFields,
                };
            });
            logTiming('5. JSON processing', processStart);
            logTiming('=== TOTAL QUERY TIME ===', queryStart);
            //console.log('[objectSearch] Timings summary:', timings);

            return {
                items: processedItems,
                totalCount: totalCount,
                facets: facets
            };
        }
    };
};
