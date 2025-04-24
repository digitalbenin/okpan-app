import { buildSchema } from 'drizzle-graphql';
import { sql, eq, aliasedTable } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull, GraphQLScalarType, Kind } from 'graphql';
import * as dbSchema from './schema';

export function createGraphQLSchema(db) {
    // Define a GraphQL JSON scalar type
    const GraphQLJSON = new GraphQLScalarType({
        name: 'JSON',
        description: 'The `JSON` scalar type represents JSON values as specified by ECMA-404',
        serialize(value) {
            return value; // Return the value directly
        },
        parseValue(value) {
            return typeof value === 'string' ? JSON.parse(value) : value;
        },
        parseLiteral(ast) {
            if (ast.kind === Kind.STRING) {
                try {
                    return JSON.parse(ast.value);
                } catch (e) {
                    return null;
                }
            }
            return null;
        }
    });

    // Get the schema from drizzle-graphql
    const drizzleResult = buildSchema(db, {
        relationsDepthLimit: 4
    });

    // Add the JSON scalar type to the schema
    drizzleResult.schema._typeMap.JSON = GraphQLJSON;

    // Modify the InstitutionsSelectItem to use JSON type for links
    if (drizzleResult.schema._typeMap.InstitutionsSelectItem) {
        const institutionsType = drizzleResult.schema._typeMap.InstitutionsSelectItem;
        if (institutionsType._fields.links) {
            institutionsType._fields.links.type = GraphQLJSON;
        }
    }

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
                'id', ${translationsTable.id},
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
                            .filter(t => t.language_code && t.content) // Keep entries with language_code and content
                            .filter((t, index, self) =>
                                index === self.findIndex(s => s.language_code === t.language_code)
                            );

                        // Make sure id field isn't null to avoid GraphQL errors
                        translations = translations.map(t => ({
                            id: t.id || `temp_${field}_${t.language_code}`, // Fallback ID to avoid null
                            language_code: t.language_code,
                            content: t.content
                        }));

                        item[field].translations = translations.length > 0 ? translations : [];
                    } catch (e) {
                        console.error(`Error parsing translations for ${field}:`, e);
                        item[field].translations = [];
                    }
                } else if (item[field]) {
                    item[field].translations = [];
                }
            });

            // Parse links field if it exists and is a string
            if (item.links && typeof item.links === 'string') {
                try {
                    item.links = JSON.parse(item.links);
                } catch (e) {
                    console.error(`Error parsing links for item ${item.id}:`, e);
                    item.links = [];
                }
            }

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
    addCountField('DatasourcesSelectItem', 'objectsCount');

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

    // Add custom query to count institutions
    drizzleResult.schema._typeMap.Query._fields.institutionsCount = {
        name: 'institutionsCount',
        type: drizzleResult.schema._typeMap.Int,
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
            }
        ],
        resolve: async (source, args, context, info) => {
            // Start with a basic count query
            let query = db
                .select({ count: sql`count(*)` })
                .from(dbSchema.institutions);

            // Apply project_id filter if specified
            if (args.project_id) {
                query = query.where(eq(dbSchema.institutions.project_id, args.project_id));
            }

            // Apply search filter if provided
            if (args.search && args.search.trim()) {
                const searchTerm = args.search.trim();
                // Use double quotes for exact phrase matching
                const searchQuery = `content:${searchTerm}*`;

                try {
                    // Add a WHERE condition to filter by institutions that match the search term
                    query = query.where(
                        sql`${dbSchema.institutions.id} IN (
                            SELECT s.institution_id 
                            FROM institutions_search s
                            WHERE s.institutions_search MATCH ${searchQuery}
                            ${args.languageCode ? sql`AND s.language_code = ${args.languageCode}` : sql``}
                        )`
                    );
                } catch (error) {
                    console.error('Error building FTS search for count:', error);
                    // If search fails, return zero
                    return 0;
                }
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

            // Create aliases for the translations tables
            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');
            const locationTranslations = aliasedTable(dbSchema.translations, 'location_translations');
            const countryTranslations = aliasedTable(dbSchema.translations, 'country_translations');

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
                status: dbSchema.institutions.status,
                links: dbSchema.institutions.links,
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
                .groupBy(dbSchema.institutions.id);

            // Execute the query
            const institutions = await query.execute();

            // Process the result
            if (institutions.length === 0) {
                return null; // Return null if no institution is found
            }

            // Process translations for the single institution
            const processedInstitutions = processTranslations(institutions, ['name', 'description', 'location', 'country']);

            // Explicitly parse the links JSON for the institution
            if (processedInstitutions[0].links && typeof processedInstitutions[0].links === 'string') {
                try {
                    processedInstitutions[0].links = JSON.parse(processedInstitutions[0].links);
                } catch (e) {
                    console.error(`Error parsing links for institution ${processedInstitutions[0].id}:`, e);
                    processedInstitutions[0].links = [];
                }
            }

            // Return the first (and only) result
            return processedInstitutions[0];
        }
    };

    // Add custom query for datasources list
    drizzleResult.schema._typeMap.Query._fields.datasourcesList = {
        name: 'datasourcesList',
        type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.DatasourcesSelectItem)),
        args: [
            {
                name: 'institution_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter datasources by institution ID'
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
            const methodTexts = aliasedTable(dbSchema.texts, 'method_texts');
            const notesTexts = aliasedTable(dbSchema.texts, 'notes_texts');

            // Create aliases for the translations tables
            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const methodTranslations = aliasedTable(dbSchema.translations, 'method_translations');
            const notesTranslations = aliasedTable(dbSchema.translations, 'notes_translations');

            // Create subquery to count distinct objects linked via ontology fields
            const objectsOntologyFieldsSubquery = db
                .select({
                    datasources_id: dbSchema.objects_ontology_fields.datasources_id,
                    // Use count(distinct object_id) to count unique objects per datasource
                    objects_count: sql`count(distinct ${dbSchema.objects_ontology_fields.object_id})`.as('objects_count')
                })
                .from(dbSchema.objects_ontology_fields)
                // Ensure we only consider rows where datasource_id is not null
                .where(sql`${dbSchema.objects_ontology_fields.datasources_id} IS NOT NULL`)
                .groupBy(dbSchema.objects_ontology_fields.datasources_id)
                .as('objects_ontology_fields_subquery');

            // Build the base query
            let query = db.select({
                id: dbSchema.datasources.id,
                created_at: dbSchema.datasources.created_at,
                updated_at: dbSchema.datasources.updated_at,
                institution_id: dbSchema.datasources.institution_id,
                language: dbSchema.datasources.language,
                copyright: dbSchema.datasources.copyright,
                contact: dbSchema.datasources.contact,
                date: dbSchema.datasources.date,
                name: createTextFieldWithTranslations(nameTexts, nameTranslations),
                method: createTextFieldWithTranslations(methodTexts, methodTranslations),
                notes: createTextFieldWithTranslations(notesTexts, notesTranslations),
                // Include the object count, defaulting to 0 if no objects are linked
                objectsCount: sql`COALESCE(${objectsOntologyFieldsSubquery.objects_count}, 0)`.as('objectsCount')
            })
                .from(dbSchema.datasources)
                // Left join with the subquery to get the object count
                .leftJoin(objectsOntologyFieldsSubquery, eq(dbSchema.datasources.id, objectsOntologyFieldsSubquery.datasources_id))
                // Joins for translated fields
                .leftJoin(nameTexts, eq(dbSchema.datasources.name_id, nameTexts.id))
                .leftJoin(nameTranslations, eq(nameTexts.id, nameTranslations.text_id))
                .leftJoin(methodTexts, eq(dbSchema.datasources.method_id, methodTexts.id))
                .leftJoin(methodTranslations, eq(methodTexts.id, methodTranslations.text_id))
                .leftJoin(notesTexts, eq(dbSchema.datasources.notes_id, notesTexts.id))
                .leftJoin(notesTranslations, eq(notesTexts.id, notesTranslations.text_id));

            // Apply institution_id filter if provided
            if (args.institution_id) {
                query = query.where(eq(dbSchema.datasources.institution_id, args.institution_id));
            }

            // Apply ordering
            let orderByField;
            const direction = args.direction === 'asc' ? 'asc' : 'desc';

            switch (args.orderBy) {
                case 'created_at':
                    orderByField = dbSchema.datasources.created_at;
                    break;
                case 'updated_at':
                    orderByField = dbSchema.datasources.updated_at;
                    break;
                case 'name':
                    // Order by the original content of the name text
                    orderByField = nameTexts.content;
                    break;
                default:
                    orderByField = dbSchema.datasources.created_at;
            }

            // Add ordering to the query
            query = query.orderBy(direction === 'asc' ? orderByField : sql`${orderByField} DESC`);

            // Apply pagination
            query = query
                .limit(args.pageSize)
                .offset(args.page * args.pageSize)
                // Group by datasource ID to consolidate translations and object count
                .groupBy(dbSchema.datasources.id);

            // Execute the paginated query
            const datasources = await query.execute();

            // Process translations FIRST
            const processedDatasources = processTranslations(datasources, ['name', 'method', 'notes']);

            return processedDatasources; // Return results without server-side date formatting
        }
    };

    return { schema: drizzleResult.schema, resolvers: drizzleResult.resolvers };
};



