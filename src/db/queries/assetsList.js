/**
 * Custom GraphQL resolver factories for assetsList related database queries and mutations.
 *
 * @namespace db.customQueries.assetsList
 */
import { sql, eq, aliasedTable, countDistinct } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLInt } from 'graphql';
import * as dbSchema from '../schema.js';

export const createAssetsListQuery = (db, drizzleResult) => {
    // Define Payload type for AssetsList
    const AssetsListPayload = new GraphQLObjectType({
        name: 'AssetsListPayload',
        fields: () => ({
            items: { type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.AssetsSelectItem)) },
            totalCount: { type: GraphQLInt }
        })
    });
    drizzleResult.schema._typeMap.AssetsListPayload = AssetsListPayload;

    return {
        name: 'assetsList',
        type: AssetsListPayload,
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter assets by project ID'
            },
            {
                name: 'institution_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter assets by institution ID'
            },
            {
                name: 'type',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter assets by type'
            },
            {
                name: 'search',
                type: drizzleResult.schema._typeMap.String,
                description: 'Search term to filter assets by filename or path (case-insensitive)'
            },
            {
                name: 'linked',
                type: drizzleResult.schema._typeMap.Boolean,
                description: 'Filter by linked status (true: linked, false: not linked)'
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
                description: 'Field to order by (created_at, updated_at, filename, type)',
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
            // Aliases for texts and translations
            const institutionNameTexts = aliasedTable(dbSchema.texts, 'inst_name_texts_assets_list');
            const institutionNameTranslations = aliasedTable(dbSchema.translations, 'inst_name_translations_assets_list');
            const projectTitleTexts = aliasedTable(dbSchema.texts, 'proj_title_texts_assets_list');
            const projectTitleTranslations = aliasedTable(dbSchema.translations, 'proj_title_translations_assets_list');

            let queryBase = db.select({
                // Asset fields
                id: dbSchema.assets.id,
                created_at: dbSchema.assets.created_at,
                updated_at: dbSchema.assets.updated_at,
                filename: dbSchema.assets.filename,
                path: dbSchema.assets.path,
                type: dbSchema.assets.type,
                formats: dbSchema.assets.formats,
                properties: dbSchema.assets.properties,
                institution_id: dbSchema.assets.institution_id,
                project_id: dbSchema.assets.project_id,

                // Institution related fields
                inst_id: dbSchema.institutions.id,
                inst_name_text_id: institutionNameTexts.id,
                inst_name_text_content: institutionNameTexts.content,
                inst_name_text_original_language_id: institutionNameTexts.original_language_id,
                inst_name_translations_json: sql`json_group_array(json_object('id', ${institutionNameTranslations.id}, 'language_id', ${institutionNameTranslations.language_id}, 'content', ${institutionNameTranslations.content}))`.append(sql`FILTER (WHERE ${institutionNameTranslations.id} IS NOT NULL)`).as('inst_name_translations_json'),

                // Project related fields
                proj_id: dbSchema.project.id,
                proj_title_text_id: projectTitleTexts.id,
                proj_title_text_content: projectTitleTexts.content,
                proj_title_text_original_language_id: projectTitleTexts.original_language_id,
                proj_title_translations_json: sql`json_group_array(json_object('id', ${projectTitleTranslations.id}, 'language_id', ${projectTitleTranslations.language_id}, 'content', ${projectTitleTranslations.content}))`.append(sql`FILTER (WHERE ${projectTitleTranslations.id} IS NOT NULL)`).as('proj_title_translations_json'),
                objects_assets_json: sql`COALESCE( (SELECT json_group_array(json_object('id', oa.id, 'object_id', oa.object_id, 'object', json_object('id', o.id, 'status', o.status))) FROM ${dbSchema.objects_assets} oa JOIN ${dbSchema.objects} o ON oa.object_id = o.id WHERE oa.asset_id = ${dbSchema.assets.id}), '[]' )`.as('objects_assets_json'),
            })
                .from(dbSchema.assets)
                .leftJoin(dbSchema.institutions, eq(dbSchema.assets.institution_id, dbSchema.institutions.id))
                .leftJoin(institutionNameTexts, eq(dbSchema.institutions.name_id, institutionNameTexts.id))
                .leftJoin(institutionNameTranslations, eq(institutionNameTexts.id, institutionNameTranslations.text_id))
                .leftJoin(dbSchema.project, eq(dbSchema.assets.project_id, dbSchema.project.id))
                .leftJoin(projectTitleTexts, eq(dbSchema.project.title_id, projectTitleTexts.id))
                .leftJoin(projectTitleTranslations, eq(projectTitleTexts.id, projectTitleTranslations.text_id));

            const conditions = [];
            if (args.project_id) {
                conditions.push(eq(dbSchema.assets.project_id, args.project_id));
            }
            if (args.institution_id) {
                conditions.push(eq(dbSchema.assets.institution_id, args.institution_id));
            }
            if (args.type) {
                conditions.push(eq(dbSchema.assets.type, args.type));
            }
            if (args.search && args.search.trim()) {
                const searchTerm = '%' + args.search.trim().toLowerCase() + '%';
                conditions.push(sql`(lower(${dbSchema.assets.filename}) LIKE ${searchTerm} OR lower(${dbSchema.assets.path}) LIKE ${searchTerm})`);
            }

            // Linked filter: true -> require at least one link; false -> require none
            if (args.linked === true) {
                conditions.push(sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_assets} oa WHERE oa.asset_id = ${dbSchema.assets.id})`);
            } else if (args.linked === false) {
                conditions.push(sql`NOT EXISTS (SELECT 1 FROM ${dbSchema.objects_assets} oa WHERE oa.asset_id = ${dbSchema.assets.id})`);
            }

            // Count query
            let countQuery = db
                .select({ totalCount: countDistinct(dbSchema.assets.id) })
                .from(dbSchema.assets);
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
                case 'updated_at':
                    orderByField = dbSchema.assets.updated_at;
                    break;
                case 'filename':
                    orderByField = dbSchema.assets.filename;
                    break;
                case 'type':
                    orderByField = dbSchema.assets.type;
                    break;
                case 'created_at':
                default:
                    orderByField = dbSchema.assets.created_at;
            }

            const queryOrdered = queryFiltered.orderBy(sql`${orderByField}${direction}`);

            const queryPaginated = queryOrdered
                .limit(args.pageSize)
                .offset(args.page * args.pageSize)
                .groupBy(
                    dbSchema.assets.id,
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
                        translations: JSON.parse(item.inst_name_translations_json || '[]').filter(t => t && t.id !== null)
                    }
                } : null;

                const project = item.proj_id ? {
                    id: item.proj_id,
                    title: {
                        id: item.proj_title_text_id,
                        content: item.proj_title_text_content,
                        original_language_id: item.proj_title_text_original_language_id,
                        translations: JSON.parse(item.proj_title_translations_json || '[]').filter(t => t && t.id !== null)
                    }
                } : null;

                let objectsAssets = [];
                if (item.objects_assets_json) {
                    try {
                        const parsedObjectLinks = JSON.parse(item.objects_assets_json);
                        objectsAssets = parsedObjectLinks.map(oa => ({
                            id: oa.id,
                            object_id: oa.object_id,
                            object: oa.object // contains id and status
                        })).filter(oa => oa.id != null);
                    } catch (e) {
                        console.error(`Error parsing objects_assets_json for asset ${item.id}:`, e);
                    }
                }

                return {
                    id: item.id,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                    filename: item.filename,
                    path: item.path,
                    type: item.type,
                    formats: typeof item.formats === 'string' ? JSON.parse(item.formats || '{}') : (item.formats || {}),
                    properties: typeof item.properties === 'string' ? JSON.parse(item.properties || '{}') : (item.properties || {}),
                    institution_id: item.institution_id,
                    project_id: item.project_id,
                    institution: institution,
                    project: project,
                    objectsAssets: objectsAssets,
                };
            });
            return { items: processedItems, totalCount: totalCount };
        }
    };
};
