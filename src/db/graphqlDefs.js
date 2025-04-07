import { buildSchema } from 'drizzle-graphql';
import { sql, eq, aliasedTable } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from './schema';

export function createGraphQLSchema(db) {
    // Get the schema from drizzle-graphql
    const drizzleResult = buildSchema(db, {
        relationsDepthLimit: 4
    });

    // Helper function to add count fields to entity types
    const addCountField = (typeName, fieldName, type = drizzleResult.schema._typeMap.Int) => {
        drizzleResult.schema._typeMap[typeName]._fields[fieldName] = {
            name: fieldName,
            type: type,
            args: [],
        };
    };

    // Helper function to create a count subquery
    const createCountSubquery = (table, foreignKeyField, countAlias) => {
        return db
            .select({
                [foreignKeyField]: table[foreignKeyField],
                [countAlias]: sql`count(*)`.as(countAlias)
            })
            .from(table)
            .groupBy(table[foreignKeyField])
            .as(countAlias);
    };

    // Helper function to create a text field with translations
    const createTextFieldWithTranslations = (textTable, translationsTable) => {
        return {
            content: textTable.content,
            id: textTable.id,
            original_language: textTable.original_language,
            translations: sql`json_group_array(json_object(
                'language_code', ${translationsTable.language_code},
                'content', ${translationsTable.content}
            ))`.as('translations')
        };
    };

    // Helper function to process translations in results
    const processTranslations = (items, fields) => {
        return items.map(item => {
            fields.forEach(field => {
                if (item[field] && item[field].translations) {
                    try {
                        // Parse the JSON string into an array
                        let translations = JSON.parse(item[field].translations);

                        // Filter out null entries and duplicates
                        translations = translations
                            .filter(t => t.language_code && t.content)
                            .filter((t, index, self) =>
                                index === self.findIndex(s => s.language_code === t.language_code)
                            );

                        item[field].translations = translations.length > 0 ? translations : [];
                    } catch (e) {
                        console.error(`Error parsing translations for ${field}:`, e);
                        item[field].translations = [];
                    }
                } else if (item[field]) {
                    item[field].translations = [];
                }
            });

            return item;
        });
    };

    // Add count fields to entity types
    addCountField('ProjectSelectItem', 'institutionsCount');
    addCountField('ProjectSelectItem', 'objectsCount');
    addCountField('ProjectSelectItem', 'assetsCount');
    addCountField('InstitutionsSelectItem', 'objectsCount');
    addCountField('InstitutionsSelectItem', 'assetsCount');
    addCountField('InstitutionsSelectItem', 'datasourcesCount');
    addCountField('InstitutionsSelectItem', 'totalCount');

    // Add custom query for projects list
    drizzleResult.schema._typeMap.Query._fields.projectsList = {
        name: 'projectsList',
        type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.ProjectSelectItem)),
        args: [],
        resolve: async (source, args, context, info) => {
            // Create aliases for the texts and translations tables
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const titleTexts = aliasedTable(dbSchema.texts, 'title_texts');
            const titleTranslations = aliasedTable(dbSchema.translations, 'title_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');

            // Create count subqueries
            const institutionsSubquery = createCountSubquery(
                dbSchema.institutions,
                'project_id',
                'institutions_count'
            );

            const objectsSubquery = createCountSubquery(
                dbSchema.objects,
                'project_id',
                'objects_count'
            );

            const assetsSubquery = createCountSubquery(
                dbSchema.assets,
                'project_id',
                'assets_count'
            );

            // Execute the query
            const projects = await db.select({
                id: dbSchema.project.id,
                created_at: dbSchema.project.created_at,
                updated_at: dbSchema.project.updated_at,
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations),
                title: createTextFieldWithTranslations(titleTexts, titleTranslations),
                institutionsCount: sql`COALESCE(${institutionsSubquery.institutions_count}, 0)`.as('institutionsCount'),
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount'),
                assetsCount: sql`COALESCE(${assetsSubquery.assets_count}, 0)`.as('assetsCount')
            })
                .from(dbSchema.project)
                .leftJoin(descriptionTexts, eq(dbSchema.project.description_id, descriptionTexts.id))
                .leftJoin(descriptionTranslations, eq(descriptionTexts.id, descriptionTranslations.text_id))
                .leftJoin(titleTexts, eq(dbSchema.project.title_id, titleTexts.id))
                .leftJoin(titleTranslations, eq(titleTexts.id, titleTranslations.text_id))
                .leftJoin(institutionsSubquery, eq(dbSchema.project.id, institutionsSubquery.project_id))
                .leftJoin(objectsSubquery, eq(dbSchema.project.id, objectsSubquery.project_id))
                .leftJoin(assetsSubquery, eq(dbSchema.project.id, assetsSubquery.project_id))
                .groupBy(dbSchema.project.id)
                .execute();

            // Process translations
            return processTranslations(projects, ['title', 'description']);
        }
    };

    // Add custom query for project by ID
    drizzleResult.schema._typeMap.Query._fields.projectById = {
        name: 'projectById',
        type: drizzleResult.schema._typeMap.ProjectSelectItem,
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'ID of the project to retrieve'
            }
        ],
        resolve: async (source, args, context, info) => {
            // Validate input
            if (!args.project_id) {
                throw new Error('project_id is required');
            }

            // Create aliases for the texts and translations tables
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const titleTexts = aliasedTable(dbSchema.texts, 'title_texts');
            const titleTranslations = aliasedTable(dbSchema.translations, 'title_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');

            // Create count subqueries
            const institutionsSubquery = createCountSubquery(
                dbSchema.institutions,
                'project_id',
                'institutions_count'
            );

            const objectsSubquery = createCountSubquery(
                dbSchema.objects,
                'project_id',
                'objects_count'
            );

            const assetsSubquery = createCountSubquery(
                dbSchema.assets,
                'project_id',
                'assets_count'
            );

            // Execute the query
            const projects = await db.select({
                id: dbSchema.project.id,
                created_at: dbSchema.project.created_at,
                updated_at: dbSchema.project.updated_at,
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations),
                title: createTextFieldWithTranslations(titleTexts, titleTranslations),
                institutionsCount: sql`COALESCE(${institutionsSubquery.institutions_count}, 0)`.as('institutionsCount'),
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount'),
                assetsCount: sql`COALESCE(${assetsSubquery.assets_count}, 0)`.as('assetsCount')
            })
                .from(dbSchema.project)
                .where(eq(dbSchema.project.id, args.project_id))
                .leftJoin(descriptionTexts, eq(dbSchema.project.description_id, descriptionTexts.id))
                .leftJoin(descriptionTranslations, eq(descriptionTexts.id, descriptionTranslations.text_id))
                .leftJoin(titleTexts, eq(dbSchema.project.title_id, titleTexts.id))
                .leftJoin(titleTranslations, eq(titleTexts.id, titleTranslations.text_id))
                .leftJoin(institutionsSubquery, eq(dbSchema.project.id, institutionsSubquery.project_id))
                .leftJoin(objectsSubquery, eq(dbSchema.project.id, objectsSubquery.project_id))
                .leftJoin(assetsSubquery, eq(dbSchema.project.id, assetsSubquery.project_id))
                .groupBy(dbSchema.project.id)
                .execute();

            // Process the result
            if (projects.length === 0) {
                return null; // Return null if no project is found
            }

            // Process translations for the single project
            const processedProjects = processTranslations(projects, ['title', 'description']);

            // Return the first (and only) result
            return processedProjects[0];
        }
    };

    // Add custom query for institutions list
    drizzleResult.schema._typeMap.Query._fields.institutionsList = {
        name: 'institutionsList',
        type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.InstitutionsSelectItem)),
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter institutions by project ID'
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
            const linksTexts = aliasedTable(dbSchema.texts, 'links_texts');

            // Create aliases for the translations tables
            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');
            const locationTranslations = aliasedTable(dbSchema.translations, 'location_translations');
            const countryTranslations = aliasedTable(dbSchema.translations, 'country_translations');
            const linksTranslations = aliasedTable(dbSchema.translations, 'links_translations');

            // Create count subqueries
            const objectsSubquery = createCountSubquery(
                dbSchema.objects,
                'institution_id',
                'objects_count'
            );

            const datasourcesSubquery = createCountSubquery(
                dbSchema.datasources,
                'institution_id',
                'datasources_count'
            );

            const assetsSubquery = createCountSubquery(
                dbSchema.assets,
                'institution_id',
                'assets_count'
            );

            // Build the base query
            let query = db.select({
                id: dbSchema.institutions.id,
                created_at: dbSchema.institutions.created_at,
                updated_at: dbSchema.institutions.updated_at,
                project_id: dbSchema.institutions.project_id,
                name: createTextFieldWithTranslations(nameTexts, nameTranslations),
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations),
                location: createTextFieldWithTranslations(locationTexts, locationTranslations),
                country: createTextFieldWithTranslations(countryTexts, countryTranslations),
                links: createTextFieldWithTranslations(linksTexts, linksTranslations),
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
                .leftJoin(countryTranslations, eq(countryTexts.id, countryTranslations.text_id))
                .leftJoin(linksTexts, eq(dbSchema.institutions.links_id, linksTexts.id))
                .leftJoin(linksTranslations, eq(linksTexts.id, linksTranslations.text_id));

            // Apply project_id filter if provided
            if (args.project_id) {
                query = query.where(eq(dbSchema.institutions.project_id, args.project_id));
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

            // Execute the paginated query
            const institutions = await query.execute();

            // Process translations
            return processTranslations(institutions, ['name', 'description', 'location', 'country', 'links']);
        }
    };

    // Add custom query to count institutions
    drizzleResult.schema._typeMap.Query._fields.institutionsCount = {
        name: 'institutionsCount',
        type: drizzleResult.schema._typeMap.Int,
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter institutions by project ID'
            }
        ],
        resolve: async (source, args, context, info) => {
            let query = db
                .select({ count: sql`count(*)` })
                .from(dbSchema.institutions);

            if (args.project_id) {
                query = query.where(eq(dbSchema.institutions.project_id, args.project_id));
            }

            const result = await query.execute();
            return result[0].count;
        }
    };

    // Add custom query for getting a single institution by ID
    drizzleResult.schema._typeMap.Query._fields.institutionById = {
        name: 'institutionById',
        type: drizzleResult.schema._typeMap.InstitutionsSelectItem,
        args: [
            {
                name: 'institution_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'ID of the institution to retrieve'
            }
        ],
        resolve: async (source, args, context, info) => {
            // Validate input
            if (!args.institution_id) {
                throw new Error('institution_id is required');
            }

            // Create aliases for the texts tables
            const nameTexts = aliasedTable(dbSchema.texts, 'name_texts');
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const locationTexts = aliasedTable(dbSchema.texts, 'location_texts');
            const countryTexts = aliasedTable(dbSchema.texts, 'country_texts');
            const linksTexts = aliasedTable(dbSchema.texts, 'links_texts');

            // Create aliases for the translations tables
            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');
            const locationTranslations = aliasedTable(dbSchema.translations, 'location_translations');
            const countryTranslations = aliasedTable(dbSchema.translations, 'country_translations');
            const linksTranslations = aliasedTable(dbSchema.translations, 'links_translations');

            // Create count subqueries
            const objectsSubquery = createCountSubquery(
                dbSchema.objects,
                'institution_id',
                'objects_count'
            );

            const datasourcesSubquery = createCountSubquery(
                dbSchema.datasources,
                'institution_id',
                'datasources_count'
            );

            const assetsSubquery = createCountSubquery(
                dbSchema.assets,
                'institution_id',
                'assets_count'
            );

            // Build the query
            const query = db.select({
                id: dbSchema.institutions.id,
                created_at: dbSchema.institutions.created_at,
                updated_at: dbSchema.institutions.updated_at,
                project_id: dbSchema.institutions.project_id,
                name: createTextFieldWithTranslations(nameTexts, nameTranslations),
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations),
                location: createTextFieldWithTranslations(locationTexts, locationTranslations),
                country: createTextFieldWithTranslations(countryTexts, countryTranslations),
                links: createTextFieldWithTranslations(linksTexts, linksTranslations),
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount'),
                datasourcesCount: sql`COALESCE(${datasourcesSubquery.datasources_count}, 0)`.as('datasourcesCount'),
                assetsCount: sql`COALESCE(${assetsSubquery.assets_count}, 0)`.as('assetsCount')
            })
                .from(dbSchema.institutions)
                .where(eq(dbSchema.institutions.id, args.institution_id))
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
                .leftJoin(countryTranslations, eq(countryTexts.id, countryTranslations.text_id))
                .leftJoin(linksTexts, eq(dbSchema.institutions.links_id, linksTexts.id))
                .leftJoin(linksTranslations, eq(linksTexts.id, linksTranslations.text_id))
                .groupBy(dbSchema.institutions.id);

            // Execute the query
            const institutions = await query.execute();

            // Process the result
            if (institutions.length === 0) {
                return null; // Return null if no institution is found
            }

            // Process translations for the single institution
            const processedInstitutions = processTranslations(institutions, ['name', 'description', 'location', 'country', 'links']);

            // Return the first (and only) result
            return processedInstitutions[0];
        }
    };

    return { schema: drizzleResult.schema, resolvers: drizzleResult.resolvers };
};



