import { sql, eq, aliasedTable, countDistinct } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLInt } from 'graphql';
import * as dbSchema from '../schema';

// Return a distinct list of objects linked to a given datasource via objects_ontology_fields
export const createObjectsByDatasourceQuery = (db, drizzleResult) => {
    // Define Payload type for ObjectsByDatasource
    const ObjectsByDatasourcePayload = new GraphQLObjectType({
        name: 'ObjectsByDatasourcePayload',
        fields: () => ({
            items: { type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.ObjectsSelectItem)) },
            totalCount: { type: GraphQLInt }
        })
    });
    drizzleResult.schema._typeMap.ObjectsByDatasourcePayload = ObjectsByDatasourcePayload;

    return {
        name: 'objectsByDatasource',
        type: ObjectsByDatasourcePayload,
        args: [
            {
                name: 'datasource_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Datasource ID to filter linked objects',
            },
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Optional filter by project ID'
            },
            {
                name: 'institution_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Optional filter by institution ID'
            },
            {
                name: 'status',
                type: drizzleResult.schema._typeMap.String,
                description: 'Optional filter by object status'
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
            // Aliases for texts and translations (consistent with objectsList)
            const institutionNameTexts = aliasedTable(dbSchema.texts, 'institution_name_texts_obj_by_ds');
            const institutionNameTranslations = aliasedTable(dbSchema.translations, 'institution_name_translations_obj_by_ds');
            const projectTitleTexts = aliasedTable(dbSchema.texts, 'project_title_texts_obj_by_ds');
            const projectTitleTranslations = aliasedTable(dbSchema.translations, 'project_title_translations_obj_by_ds');

            // Build queries to get all ontology and research fields
            const ontologyFieldsQuery = sql`(SELECT json_group_array(json_object('id', oof.id, 'value', oof.value, 'field_id', oof.field_id, 'primary', oof."primary", 'default_description', oof.default_description, 'ontology_field_name_id', ot.name_id, 'ontology_field_name_content', ot_name_texts.content )) FROM ${dbSchema.objects_ontology_fields} oof JOIN ${dbSchema.ontology_fields} ot ON oof.field_id = ot.id JOIN ${dbSchema.texts} ot_name_texts ON ot.name_id = ot_name_texts.id WHERE oof.object_id = ${dbSchema.objects.id})`;
            const researchFieldsQuery = sql`(SELECT json_group_array(json_object('id', orf.id, 'value', orf.value, 'field_id', orf.field_id, 'research_field_name_id', rf.name_id, 'research_field_name_content', rf_name_texts.content, 'vocabulary_id', orf.vocabulary_id, 'vocabulary_option_content', v_option_texts.content )) FROM ${dbSchema.objects_research_fields} orf JOIN ${dbSchema.research_fields} rf ON orf.field_id = rf.id JOIN ${dbSchema.texts} rf_name_texts ON rf.name_id = rf_name_texts.id LEFT JOIN ${dbSchema.vocabularies} v ON orf.vocabulary_id = v.id LEFT JOIN ${dbSchema.texts} v_option_texts ON v.option_id = v_option_texts.id WHERE orf.object_id = ${dbSchema.objects.id})`;

            let queryBase = db.select({
                id: dbSchema.objects.id,
                created_at: dbSchema.objects.created_at,
                updated_at: dbSchema.objects.updated_at,
                status: dbSchema.objects.status,
                name: dbSchema.objects.name,
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
            })
                .from(dbSchema.objects)
                .leftJoin(dbSchema.institutions, eq(dbSchema.objects.institution_id, dbSchema.institutions.id))
                .leftJoin(institutionNameTexts, eq(dbSchema.institutions.name_id, institutionNameTexts.id))
                .leftJoin(institutionNameTranslations, eq(institutionNameTexts.id, institutionNameTranslations.text_id))
                .leftJoin(dbSchema.project, eq(dbSchema.objects.project_id, dbSchema.project.id))
                .leftJoin(projectTitleTexts, eq(dbSchema.project.title_id, projectTitleTexts.id))
                .leftJoin(projectTitleTranslations, eq(projectTitleTexts.id, projectTitleTranslations.text_id));

            const conditions = [];

            // Require linkage to the provided datasource via objects_ontology_fields
            if (args.datasource_id) {
                conditions.push(sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_ontology_fields} oof WHERE oof.object_id = ${dbSchema.objects.id} AND oof.datasources_id = ${args.datasource_id})`);
            }
            if (args.project_id) {
                conditions.push(eq(dbSchema.objects.project_id, args.project_id));
            }
            if (args.institution_id) {
                conditions.push(eq(dbSchema.objects.institution_id, args.institution_id));
            }
            if (args.status) {
                conditions.push(eq(dbSchema.objects.status, args.status));
            }

            // Count query for distinct objects
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
            const queryPaginated = queryOrdered
                .limit(args.pageSize)
                .offset(args.page * args.pageSize)
                .groupBy(
                    dbSchema.objects.id,
                    dbSchema.institutions.id,
                    institutionNameTexts.id,
                    dbSchema.project.id,
                    projectTitleTexts.id
                );

            const rawResults = await queryPaginated.execute();

            const processedItems = rawResults.map(item => {
                const institution = item.inst_id ? {
                    id: item.inst_id,
                    name: {
                        id: item.inst_name_text_id,
                        content: item.inst_name_text_content,
                        original_language_id: item.inst_name_text_original_language_id,
                        translations: JSON.parse(item.inst_name_translations_json || '[]').filter(t => t.id !== null)
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
                            }
                            return result;
                        }).filter(orf => orf.id != null);
                    } catch (e) { console.error('Error parsing objects_research_fields_json:', e); }
                }

                return {
                    id: item.id,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                    status: item.status,
                    name: item.name,
                    institution_id: item.institution_id,
                    project_id: item.project_id,
                    institution,
                    project,
                    objectsAssets,
                    objectsOntologyFields,
                    objectsResearchFields,
                };
            });

            return { items: processedItems, totalCount };
        }
    };
};