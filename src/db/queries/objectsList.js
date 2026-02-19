import { sql, eq, aliasedTable, countDistinct } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLInt, GraphQLString } from 'graphql';
import * as dbSchema from '../schema';
import { addCountField, GraphQLJSON } from './common';

export const createObjectsListQuery = (db, drizzleResult) => {
    // Add displayFields as a JSON field to ObjectsSelectItem type
    addCountField(drizzleResult, 'ObjectsSelectItem', 'displayFields', GraphQLJSON);

    // Define Payload type for ObjectsList
    const ObjectsListPayload = new GraphQLObjectType({
        name: 'ObjectsListPayload',
        fields: () => ({
            items: { type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.ObjectsSelectItem)) },
            totalCount: { type: GraphQLInt }
        })
    });
    drizzleResult.schema._typeMap.ObjectsListPayload = ObjectsListPayload;

    return {
        name: 'objectsList',
        type: ObjectsListPayload,
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter objects by project ID'
            },
            {
                name: 'institution_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter objects by institution ID'
            },
            {
                name: 'search',
                type: drizzleResult.schema._typeMap.String,
                description: 'Search term to filter objects by status (case-insensitive)'
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
                description: 'Field to order by (created_at, updated_at, status)',
                defaultValue: 'created_at'
            },
            {
                name: 'direction',
                type: drizzleResult.schema._typeMap.String,
                description: 'Sort direction (asc or desc)',
                defaultValue: 'desc'
            }
        ],
        resolve: async (source, args, context, info) => {
            const institutionNameTexts = aliasedTable(dbSchema.texts, 'institution_name_texts_obj_list');
            const institutionNameTranslations = aliasedTable(dbSchema.translations, 'institution_name_translations_obj_list');

            const projectTitleTexts = aliasedTable(dbSchema.texts, 'project_title_texts_obj_list');
            const projectTitleTranslations = aliasedTable(dbSchema.translations, 'project_title_translations_obj_list');

            // Get display fields configuration for the project
            let displayFields = [];
            if (args.project_id) {
                const displayFieldsResult = await db
                    .select({
                        id: dbSchema.object_display_fields.id,
                        ontology_field_id: dbSchema.object_display_fields.ontology_field_id,
                        research_field_id: dbSchema.object_display_fields.research_field_id,
                        property_name: dbSchema.object_display_fields.property_name
                    })
                    .from(dbSchema.object_display_fields)
                    .where(eq(dbSchema.object_display_fields.project_id, args.project_id))
                    .execute();
                displayFields = displayFieldsResult;
            }

            // Build queries to get all ontology and research fields (no filtering)
            const ontologyFieldsQuery = sql`(SELECT json_group_array(json_object('id', oof.id, 'value', oof.value, 'field_id', oof.field_id, 'primary', oof."primary", 'default_description', oof.default_description, 'ontology_field_name_id', ot.name_id, 'ontology_field_name_content', ot_name_texts.content )) FROM ${dbSchema.objects_ontology_fields} oof JOIN ${dbSchema.ontology_fields} ot ON oof.field_id = ot.id JOIN ${dbSchema.texts} ot_name_texts ON ot.name_id = ot_name_texts.id WHERE oof.object_id = ${dbSchema.objects.id})`;

            const researchFieldsQuery = sql`(SELECT json_group_array(json_object('id', orf.id, 'value', orf.value, 'field_id', orf.field_id, 'research_field_name_id', rf.name_id, 'research_field_name_content', rf_name_texts.content, 'vocabulary_id', orf.vocabulary_id, 'vocabulary_option_content', v_option_texts.content, 'vocabulary_main_asset_id', ga.id, 'vocabulary_main_asset_path', ga.path, 'vocabulary_main_asset_formats', ga.formats, 'vocabulary_main_asset_type', ga.type )) FROM ${dbSchema.objects_research_fields} orf JOIN ${dbSchema.research_fields} rf ON orf.field_id = rf.id JOIN ${dbSchema.texts} rf_name_texts ON rf.name_id = rf_name_texts.id LEFT JOIN ${dbSchema.vocabularies} v ON orf.vocabulary_id = v.id LEFT JOIN ${dbSchema.texts} v_option_texts ON v.option_id = v_option_texts.id LEFT JOIN ${dbSchema.genericAssets} ga ON v.main_asset_id = ga.id WHERE orf.object_id = ${dbSchema.objects.id})`;

            let queryBase = db.select({
                id: dbSchema.objects.id,
                name: dbSchema.objects.name,
                created_at: dbSchema.objects.created_at,
                updated_at: dbSchema.objects.updated_at,
                status: dbSchema.objects.status,
                institution_id: dbSchema.objects.institution_id,
                project_id: dbSchema.objects.project_id,

                inst_id: dbSchema.institutions.id,
                inst_name_text_id: institutionNameTexts.id,
                inst_name_text_content: institutionNameTexts.content,
                inst_name_text_original_language_id: institutionNameTexts.original_language_id,
                inst_name_translations: sql`json_group_array(json_object('id', ${institutionNameTranslations.id}, 'language_id', ${institutionNameTranslations.language_id}, 'content', ${institutionNameTranslations.content}))`.append(sql`FILTER (WHERE ${institutionNameTranslations.id} IS NOT NULL)`).as('inst_name_translations_json'),

                proj_id: dbSchema.project.id,
                proj_title_text_id: projectTitleTexts.id,
                proj_title_text_content: projectTitleTexts.content,
                proj_title_text_original_language_id: projectTitleTexts.original_language_id,
                proj_title_translations: sql`json_group_array(json_object('id', ${projectTitleTranslations.id}, 'language_id', ${projectTitleTranslations.language_id}, 'content', ${projectTitleTranslations.content}))`.append(sql`FILTER (WHERE ${projectTitleTranslations.id} IS NOT NULL)`).as('proj_title_translations_json'),

                objects_assets_json: sql`(SELECT json_group_array(json_object('order', oa."order", 'asset_id', oa.asset_id, 'asset_filename', a.filename, 'asset_formats', a.formats, 'asset_path', a.path, 'asset_type', a.type, 'asset_real_id', a.id)) FROM ${dbSchema.objects_assets} oa JOIN ${dbSchema.assets} a ON oa.asset_id = a.id WHERE oa.object_id = ${dbSchema.objects.id})`.as('objects_assets_json'),
                objects_ontology_fields_json: ontologyFieldsQuery.as('objects_ontology_fields_json'),
                objects_research_fields_json: researchFieldsQuery.as('objects_research_fields_json'),
                display_fields_json: sql`${JSON.stringify(displayFields)}`.as('display_fields_json'),

            })
                .from(dbSchema.objects)
                .leftJoin(dbSchema.institutions, eq(dbSchema.objects.institution_id, dbSchema.institutions.id))
                .leftJoin(institutionNameTexts, eq(dbSchema.institutions.name_id, institutionNameTexts.id))
                .leftJoin(institutionNameTranslations, eq(institutionNameTexts.id, institutionNameTranslations.text_id))
                .leftJoin(dbSchema.project, eq(dbSchema.objects.project_id, dbSchema.project.id))
                .leftJoin(projectTitleTexts, eq(dbSchema.project.title_id, projectTitleTexts.id))
                .leftJoin(projectTitleTranslations, eq(projectTitleTexts.id, projectTitleTranslations.text_id));

            const conditions = [];
            if (args.project_id) {
                conditions.push(eq(dbSchema.objects.project_id, args.project_id));
            }
            if (args.institution_id) {
                conditions.push(eq(dbSchema.objects.institution_id, args.institution_id));
            }
            if (args.status) {
                conditions.push(eq(dbSchema.objects.status, args.status));
            }
            if (args.search && args.search.trim()) {
                const term = '%' + args.search.trim().toLowerCase() + '%';
                const searchConditions = [
                    // Match object name
                    sql`lower(coalesce(${dbSchema.objects.name}, '')) LIKE ${term}`,

                    // Match institution name via subquery (safe for count query too)
                    sql`EXISTS (
                        SELECT 1 FROM ${dbSchema.institutions} inst
                        JOIN ${dbSchema.texts} inst_name_texts ON inst.name_id = inst_name_texts.id
                        WHERE inst.id = ${dbSchema.objects.institution_id}
                          AND lower(inst_name_texts.content) LIKE ${term}
                    )`,

                    // Match ontology fields (value or field name)
                    sql`EXISTS (
                        SELECT 1 FROM ${dbSchema.objects_ontology_fields} oof
                        JOIN ${dbSchema.ontology_fields} ot ON oof.field_id = ot.id
                        JOIN ${dbSchema.texts} ot_name_texts ON ot.name_id = ot_name_texts.id
                        WHERE oof.object_id = ${dbSchema.objects.id}
                          AND (lower(oof.value) LIKE ${term} OR lower(ot_name_texts.content) LIKE ${term})
                    )`,
                    // Match research fields (value, field name, or vocabulary option)
                    sql`EXISTS (
                        SELECT 1 FROM ${dbSchema.objects_research_fields} orf
                        LEFT JOIN ${dbSchema.vocabularies} v ON orf.vocabulary_id = v.id
                        LEFT JOIN ${dbSchema.texts} v_option_texts ON v.option_id = v_option_texts.id
                        JOIN ${dbSchema.research_fields} rf ON orf.field_id = rf.id
                        JOIN ${dbSchema.texts} rf_name_texts ON rf.name_id = rf_name_texts.id
                        WHERE orf.object_id = ${dbSchema.objects.id}
                          AND (
                              lower(orf.value) LIKE ${term}
                              OR lower(rf_name_texts.content) LIKE ${term}
                              OR lower(v_option_texts.content) LIKE ${term}
                          )
                    )`
                ];
                conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
            }

            // Count query
            let countQuery = db
                .select({ totalCount: countDistinct(dbSchema.objects.id) })
                .from(dbSchema.objects);
            if (conditions.length > 0) {
                countQuery = countQuery.where(sql.join(conditions, sql` AND `));
            }
            const countResult = await countQuery.execute();
            const totalCount = countResult[0]?.totalCount || 0;

            let queryFiltered = queryBase;
            if (conditions.length > 0) {
                queryFiltered = queryFiltered.where(sql.join(conditions, sql` AND `));
            }

            let orderByField;
            const direction = args.direction === 'asc' ? sql` ASC` : sql` DESC`;
            switch (args.orderBy) {
                case 'updated_at': orderByField = dbSchema.objects.updated_at; break;
                case 'status': orderByField = dbSchema.objects.status; break;
                case 'created_at': default: orderByField = dbSchema.objects.created_at; break;
            }

            const queryOrdered = queryFiltered.orderBy(sql`${orderByField}${direction}`);
            // Reduce GROUP BY to objects.id only to avoid over-grouping that can yield empty result sets
            const queryPaginated = queryOrdered
                .limit(args.pageSize)
                .offset(args.page * args.pageSize)
                .groupBy(dbSchema.objects.id);

            const rawResults = await queryPaginated.execute();

            const processedItems = rawResults.map(item => {
                const institution = item.inst_id ? {
                    id: item.inst_id,
                    name: {
                        id: item.inst_name_text_id,
                        content: item.inst_name_text_content,
                        original_language_id: item.inst_name_text_original_language_id,
                        translations: JSON.parse(item.inst_name_translations_json || '[]').filter(t => t.id !== null) // Ensure translations array integrity
                    }
                } : null;

                const project = item.proj_id ? {
                    id: item.proj_id,
                    title: {
                        id: item.proj_title_text_id,
                        content: item.proj_title_text_content,
                        original_language_id: item.proj_title_text_original_language_id,
                        translations: JSON.parse(item.proj_title_translations_json || '[]').filter(t => t.id !== null)
                    }
                } : null;

                let objectsAssets = [];
                if (item.objects_assets_json) {
                    try {
                        const parsedAssets = JSON.parse(item.objects_assets_json);
                        objectsAssets = parsedAssets.map(oa => ({
                            order: oa.order,
                            asset: {
                                id: oa.asset_real_id, // Use the actual asset ID for the object
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
                                id: oof.field_id, // This is the ontology_field_id
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
                                    id: orf.field_id, // This is the research_field_id
                                    name: { content: orf.research_field_name_content }
                                }
                            };

                            // Add vocabulary information if available
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

                // Build display_fields array based on configuration
                const displayFieldsArray = [];
                if (item.display_fields_json) {
                    try {
                        const configuredFields = JSON.parse(item.display_fields_json);
                        configuredFields.forEach(df => {
                            if (df.property_name) {
                                // Handle object properties
                                displayFieldsArray.push({
                                    type: 'object_property',
                                    value: df.property_name
                                });
                            } else if (df.research_field_id) {
                                // Handle research fields
                                displayFieldsArray.push({
                                    type: 'research_field',
                                    value: df.research_field_id
                                });
                            } else if (df.ontology_field_id) {
                                // Handle ontology fields
                                displayFieldsArray.push({
                                    type: 'ontology_field',
                                    value: df.ontology_field_id
                                });
                            }
                        });
                    } catch (e) {
                        console.error('Error parsing display_fields_json:', e);
                    }
                }

                return {
                    id: item.id,
                    name: item.name,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                    status: item.status,
                    institution_id: item.institution_id,
                    project_id: item.project_id,
                    institution: institution,
                    project: project,
                    objectsAssets: objectsAssets,
                    objectsOntologyFields: objectsOntologyFields,
                    objectsResearchFields: objectsResearchFields,
                    displayFields: displayFieldsArray,
                };
            });
            return { items: processedItems, totalCount: totalCount };
        }
    };
};