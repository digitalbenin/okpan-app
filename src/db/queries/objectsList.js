import { sql, eq, aliasedTable, countDistinct } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLInt } from 'graphql';
import * as dbSchema from '../schema';

export const createObjectsListQuery = (db, drizzleResult) => {
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

            let queryBase = db.select({
                id: dbSchema.objects.id,
                created_at: dbSchema.objects.created_at,
                updated_at: dbSchema.objects.updated_at,
                status: dbSchema.objects.status,
                institution_id: dbSchema.objects.institution_id,
                project_id: dbSchema.objects.project_id,

                inst_id: dbSchema.institutions.id,
                inst_name_text_id: institutionNameTexts.id,
                inst_name_text_content: institutionNameTexts.content,
                inst_name_text_original_language: institutionNameTexts.original_language,
                inst_name_translations: sql`json_group_array(json_object('id', ${institutionNameTranslations.id}, 'language_code', ${institutionNameTranslations.language_code}, 'content', ${institutionNameTranslations.content}))`.append(sql`FILTER (WHERE ${institutionNameTranslations.id} IS NOT NULL)`).as('inst_name_translations_json'),

                proj_id: dbSchema.project.id,
                proj_title_text_id: projectTitleTexts.id,
                proj_title_text_content: projectTitleTexts.content,
                proj_title_text_original_language: projectTitleTexts.original_language,
                proj_title_translations: sql`json_group_array(json_object('id', ${projectTitleTranslations.id}, 'language_code', ${projectTitleTranslations.language_code}, 'content', ${projectTitleTranslations.content}))`.append(sql`FILTER (WHERE ${projectTitleTranslations.id} IS NOT NULL)`).as('proj_title_translations_json'),

                objects_assets_json: sql`(SELECT json_group_array(json_object('order', oa."order", 'asset_id', oa.asset_id, 'asset_filename', a.filename, 'asset_formats', a.formats, 'asset_path', a.path, 'asset_type', a.type, 'asset_real_id', a.id)) FROM ${dbSchema.objects_assets} oa JOIN ${dbSchema.assets} a ON oa.asset_id = a.id WHERE oa.object_id = ${dbSchema.objects.id})`.as('objects_assets_json'),
                objects_ontology_fields_json: sql`(SELECT json_group_array(json_object('id', oof.id, 'value', oof.value, 'field_id', oof.field_id, 'ontology_field_name_id', ot.name_id, 'ontology_field_name_content', ot_name_texts.content )) FROM ${dbSchema.objects_ontology_fields} oof JOIN ${dbSchema.ontology_fields} ot ON oof.field_id = ot.id JOIN ${dbSchema.texts} ot_name_texts ON ot.name_id = ot_name_texts.id WHERE oof.object_id = ${dbSchema.objects.id})`.as('objects_ontology_fields_json'),

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
                conditions.push(sql`lower(${dbSchema.objects.status}) LIKE ${'%' + args.search.trim().toLowerCase() + '%'}`);
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
            const queryPaginated = queryOrdered.limit(args.pageSize).offset(args.page * args.pageSize).groupBy(dbSchema.objects.id, dbSchema.institutions.id, institutionNameTexts.id, dbSchema.project.id, projectTitleTexts.id);

            const rawResults = await queryPaginated.execute();

            const processedItems = rawResults.map(item => {
                const institution = item.inst_id ? {
                    id: item.inst_id,
                    name: {
                        id: item.inst_name_text_id,
                        content: item.inst_name_text_content,
                        original_language: item.inst_name_text_original_language,
                        translations: JSON.parse(item.inst_name_translations_json || '[]').filter(t => t.id !== null) // Ensure translations array integrity
                    }
                } : null;

                const project = item.proj_id ? {
                    id: item.proj_id,
                    title: {
                        id: item.proj_title_text_id,
                        content: item.proj_title_text_content,
                        original_language: item.proj_title_text_original_language,
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
                            ontologyField: {
                                id: oof.field_id, // This is the ontology_field_id
                                name: { content: oof.ontology_field_name_content }
                            }
                        })).filter(oof => oof.id != null);
                    } catch (e) { console.error('Error parsing objects_ontology_fields_json:', e); }
                }

                return {
                    id: item.id,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                    status: item.status,
                    institution_id: item.institution_id,
                    project_id: item.project_id,
                    institution: institution,
                    project: project,
                    objectsAssets: objectsAssets,
                    objectsOntologyFields: objectsOntologyFields,
                };
            });
            return { items: processedItems, totalCount: totalCount };
        }
    };
}; 