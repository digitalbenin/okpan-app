import { sql, eq, aliasedTable } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema';
import { addCountField, createCountSubquery, createTextFieldWithTranslations, processTranslations } from './common';

export const createInstitutionsListQuery = (db, drizzleResult) => {
    // Add count fields to InstitutionsSelectItem type
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'objectsCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'assetsCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'datasourcesCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'totalCount');

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
                name: createTextFieldWithTranslations(nameTexts, nameTranslations),
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations),
                location: createTextFieldWithTranslations(locationTexts, locationTranslations),
                country: createTextFieldWithTranslations(countryTexts, countryTranslations),
                status: dbSchema.institutions.status,
                links: dbSchema.institutions.links,
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount'),
                datasourcesCount: sql`COALESCE(${datasourcesSubquery.datasources_count}, 0)`.as('datasourcesCount'),
                assetsCount: sql`COALESCE(${assetsSubquery.assets_count}, 0)`.as('assetsCount')
            })
                .from(dbSchema.institutions)
                .leftJoin(objectsSubquery, eq(dbSchema.institutions.id, objectsSubquery.institution_id))
                .leftJoin(datasourcesSubquery, eq(dbSchema.institutions.id, datasourcesSubquery.institution_id))
                .leftJoin(assetsSubquery, eq(dbSchema.institutions.id, assetsSubquery.institution_id))
                .leftJoin(nameTexts, eq(dbSchema.institutions.name_id, nameTexts.id))
                .leftJoin(nameTranslations, eq(nameTexts.id, nameTranslations.text_id))
                .leftJoin(descriptionTexts, eq(dbSchema.institutions.description_id, descriptionTexts.id))
                .leftJoin(descriptionTranslations, eq(descriptionTexts.id, descriptionTranslations.text_id))
                .leftJoin(locationTexts, eq(dbSchema.institutions.location_id, locationTexts.id))
                .leftJoin(locationTranslations, eq(locationTexts.id, locationTranslations.text_id))
                .leftJoin(countryTexts, eq(dbSchema.institutions.country_id, countryTexts.id))
                .leftJoin(countryTranslations, eq(countryTexts.id, countryTranslations.text_id));

            // Apply the project_id filter if specified
            if (args.project_id) {
                query = query.where(eq(dbSchema.institutions.project_id, args.project_id));
            }

            // Apply search filter if provided
            if (args.search && args.search.trim()) {
                const searchTerm = args.search.trim();
                // Use double quotes for exact phrase matching
                const searchQuery = `content:${searchTerm}*`;

                try {
                    // Join the main query with the search results
                    query = query.where(
                        sql`${dbSchema.institutions.id} IN (
                            SELECT s.institution_id 
                            FROM institutions_search s
                            WHERE s.institutions_search MATCH ${searchQuery}
                            ${args.languageCode ? sql`AND s.language_code = ${args.languageCode}` : sql``}
                        )`
                    );
                } catch (error) {
                    console.error('Error building FTS search:', error);
                    // If search fails, return no results
                    return [];
                }
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

            // Explicitly parse the links JSON for each institution
            results.forEach(institution => {
                if (institution.links && typeof institution.links === 'string') {
                    try {
                        institution.links = JSON.parse(institution.links);
                    } catch (e) {
                        console.error(`Error parsing links for institution ${institution.id}:`, e);
                        institution.links = [];
                    }
                }
            });

            return results;
        }
    };
}; 