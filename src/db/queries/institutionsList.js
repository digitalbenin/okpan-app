import { sql, eq, aliasedTable, and } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema';
import { addCountField, buildSafeFtsAndPrefixQuery, createCountSubquery, createTextFieldWithTranslations, processTranslations } from './common';

export const createInstitutionsListQuery = (db, drizzleResult) => {
    // Add count fields to InstitutionsSelectItem type
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'objectsCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'assetsCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'datasourcesCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'totalCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'previewImages', drizzleResult.schema._typeMap.JSON);

    return {
        name: 'institutionsList',
        type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.InstitutionsSelectItem)),
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
                description: 'Field to order by (created_at, updated_at, name)',
                defaultValue: 'created_at'
            },
            {
                name: 'direction',
                type: drizzleResult.schema._typeMap.String,
                description: 'Sort direction (asc or desc)',
                defaultValue: 'desc'
            },
            {
                name: 'status',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter institutions by status'
            }
        ],
        resolve: async (source, args, context, info) => {
            // Create aliases for the texts tables
            const nameTexts = aliasedTable(dbSchema.texts, 'name_texts');
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const locationTexts = aliasedTable(dbSchema.texts, 'location_texts');
            const countryTexts = aliasedTable(dbSchema.texts, 'country_texts');

            // Create aliases for the translations tables
            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');
            const locationTranslations = aliasedTable(dbSchema.translations, 'location_translations');
            const countryTranslations = aliasedTable(dbSchema.translations, 'country_translations');

            // Create aliases for the languages tables
            const nameLanguages = aliasedTable(dbSchema.languages, 'name_languages');
            const descriptionLanguages = aliasedTable(dbSchema.languages, 'description_languages');
            const locationLanguages = aliasedTable(dbSchema.languages, 'location_languages');
            const countryLanguages = aliasedTable(dbSchema.languages, 'country_languages');

            // Create count subqueries
            const objectsSubquery = createCountSubquery(
                db,
                dbSchema.objects,
                'institution_id',
                'objects_count'
            );

            const datasourcesSubquery = createCountSubquery(
                db,
                dbSchema.datasources,
                'institution_id',
                'datasources_count'
            );

            const assetsSubquery = createCountSubquery(
                db,
                dbSchema.assets,
                'institution_id',
                'assets_count'
            );

            // Start building the base query with all necessary joins for display
            let query = db.select({
                id: dbSchema.institutions.id,
                created_at: dbSchema.institutions.created_at,
                updated_at: dbSchema.institutions.updated_at,
                project_id: dbSchema.institutions.project_id,
                name: createTextFieldWithTranslations(nameTexts, nameTranslations, nameLanguages),
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations, descriptionLanguages),
                location: createTextFieldWithTranslations(locationTexts, locationTranslations, locationLanguages),
                country: createTextFieldWithTranslations(countryTexts, countryTranslations, countryLanguages),
                status: dbSchema.institutions.status,
                links: dbSchema.institutions.links,
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount'),
                datasourcesCount: sql`COALESCE(${datasourcesSubquery.datasources_count}, 0)`.as('datasourcesCount'),
                assetsCount: sql`COALESCE(${assetsSubquery.assets_count}, 0)`.as('assetsCount'),
                previewImages: sql`COALESCE(
                    (
                        SELECT json_group_array(json(preview.formats))
                        FROM (
                            SELECT a.formats
                            FROM assets a
                            WHERE a.institution_id = ${dbSchema.institutions.id}
                              AND (LOWER(a.type) LIKE '%image%'
                                   OR LOWER(a.filename) LIKE '%.jpg'
                                   OR LOWER(a.filename) LIKE '%.png'
                                   OR LOWER(a.filename) LIKE '%.jpeg'
                                   OR LOWER(a.filename) LIKE '%.avif'
                                   OR LOWER(a.filename) LIKE '%.webp')
                            ORDER BY a.created_at DESC
                            LIMIT 3
                        ) preview
                    ),
                    (
                        SELECT json_group_array(json(preview.formats)) 
                        FROM (
                            SELECT a.formats
                            FROM (
                                SELECT o.id, o.created_at
                                FROM objects o
                                JOIN objects_assets oa ON o.id = oa.object_id
                                JOIN assets a ON oa.asset_id = a.id
                                WHERE o.institution_id = ${dbSchema.institutions.id}
                                  AND (LOWER(a.type) LIKE '%image%' 
                                       OR LOWER(a.filename) LIKE '%.jpg'
                                       OR LOWER(a.filename) LIKE '%.png'
                                       OR LOWER(a.filename) LIKE '%.jpeg' 
                                       OR LOWER(a.filename) LIKE '%.avif'
                                       OR LOWER(a.filename) LIKE '%.webp')
                                GROUP BY o.id
                                ORDER BY o.created_at DESC
                                LIMIT 3
                            ) top_objects
                            JOIN objects_assets oa ON top_objects.id = oa.object_id
                            JOIN assets a ON oa.asset_id = a.id  
                            WHERE (LOWER(a.type) LIKE '%image%' 
                                   OR LOWER(a.filename) LIKE '%.jpg'
                                   OR LOWER(a.filename) LIKE '%.png'
                                   OR LOWER(a.filename) LIKE '%.jpeg' 
                                   OR LOWER(a.filename) LIKE '%.avif'
                                   OR LOWER(a.filename) LIKE '%.webp')
                                AND oa."order" = (
                                    SELECT MIN(oa2."order")
                                    FROM objects_assets oa2
                                    JOIN assets a2 ON oa2.asset_id = a2.id
                                    WHERE oa2.object_id = top_objects.id
                                        AND (LOWER(a2.type) LIKE '%image%' 
                                             OR LOWER(a2.filename) LIKE '%.jpg'
                                             OR LOWER(a2.filename) LIKE '%.png'
                                             OR LOWER(a2.filename) LIKE '%.jpeg' 
                                             OR LOWER(a2.filename) LIKE '%.avif'
                                             OR LOWER(a2.filename) LIKE '%.webp')
                                )
                            ORDER BY top_objects.created_at DESC
                        ) preview
                    ),
                    '[]'
                )`.as('previewImages')
            })
                .from(dbSchema.institutions)
                .leftJoin(objectsSubquery, eq(dbSchema.institutions.id, objectsSubquery.institution_id))
                .leftJoin(datasourcesSubquery, eq(dbSchema.institutions.id, datasourcesSubquery.institution_id))
                .leftJoin(assetsSubquery, eq(dbSchema.institutions.id, assetsSubquery.institution_id))
                .leftJoin(nameTexts, eq(dbSchema.institutions.name_id, nameTexts.id))
                .leftJoin(nameTranslations, eq(nameTexts.id, nameTranslations.text_id))
                .leftJoin(nameLanguages, eq(nameTranslations.language_id, nameLanguages.id))
                .leftJoin(descriptionTexts, eq(dbSchema.institutions.description_id, descriptionTexts.id))
                .leftJoin(descriptionTranslations, eq(descriptionTexts.id, descriptionTranslations.text_id))
                .leftJoin(descriptionLanguages, eq(descriptionTranslations.language_id, descriptionLanguages.id))
                .leftJoin(locationTexts, eq(dbSchema.institutions.location_id, locationTexts.id))
                .leftJoin(locationTranslations, eq(locationTexts.id, locationTranslations.text_id))
                .leftJoin(locationLanguages, eq(locationTranslations.language_id, locationLanguages.id))
                .leftJoin(countryTexts, eq(dbSchema.institutions.country_id, countryTexts.id))
                .leftJoin(countryTranslations, eq(countryTexts.id, countryTranslations.text_id))
                .leftJoin(countryLanguages, eq(countryTranslations.language_id, countryLanguages.id));

            const whereConditions = [];

            // Apply the project_id filter if specified
            if (args.project_id) {
                whereConditions.push(eq(dbSchema.institutions.project_id, args.project_id));
            }

            // Apply the status filter if specified
            if (args.status) {
                whereConditions.push(eq(dbSchema.institutions.status, args.status));
            }

            // Apply search filter if provided
            if (args.search && args.search.trim()) {
                const searchQuery = buildSafeFtsAndPrefixQuery(args.search);

                if (!searchQuery) {
                    return [];
                }

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

                    whereConditions.push(sql`${dbSchema.institutions.id} IN (
                        SELECT s.institution_id 
                        FROM institutions_search s
                        WHERE s.institutions_search MATCH ${searchQuery}
                        ${languageFilter}
                    )`);
                } catch (error) {
                    console.error('Error building FTS search:', error);
                    // If search fails, return no results
                    return [];
                }
            }

            if (whereConditions.length > 0) {
                query = query.where(and(...whereConditions));
            }

            // Apply ordering
            let orderByField;
            const direction = args.direction === 'asc' ? 'asc' : 'desc';

            switch (args.orderBy) {
                case 'created_at':
                    orderByField = dbSchema.institutions.created_at;
                    break;
                case 'updated_at':
                    orderByField = dbSchema.institutions.updated_at;
                    break;
                case 'name':
                    orderByField = nameTexts.content;
                    break;
                case 'objectsCount':
                    orderByField = sql`objectsCount`;
                    break;
                case 'datasourcesCount':
                    orderByField = sql`datasourcesCount`;
                    break;
                case 'assetsCount':
                    orderByField = sql`assetsCount`;
                    break;
                default:
                    orderByField = dbSchema.institutions.created_at;
            }

            // Add ordering to the query
            query = query.orderBy(direction === 'asc' ? orderByField : sql`${orderByField} DESC`);

            // Apply pagination
            query = query
                .limit(args.pageSize)
                .offset(args.page * args.pageSize)
                .groupBy(dbSchema.institutions.id);

            // Execute the query
            const institutions = await query.execute();

            // Process translations
            const results = processTranslations(institutions, ['name', 'description', 'location', 'country']);

            // Explicitly parse the links and preview images JSON for each institution
            results.forEach(institution => {
                if (institution.links && typeof institution.links === 'string') {
                    try {
                        institution.links = JSON.parse(institution.links);
                    } catch (e) {
                        console.error(`Error parsing links for institution ${institution.id}:`, e);
                        institution.links = [];
                    }
                }

                if (institution.previewImages && typeof institution.previewImages === 'string') {
                    try {
                        institution.previewImages = JSON.parse(institution.previewImages);
                    } catch (e) {
                        console.error(`Error parsing preview images for institution ${institution.id}:`, e);
                        institution.previewImages = [];
                    }
                } else if (!institution.previewImages) {
                    institution.previewImages = [];
                }
            });

            return results;
        }
    };
}; 