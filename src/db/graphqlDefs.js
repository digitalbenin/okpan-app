import { buildSchema } from 'drizzle-graphql';
import { sql, eq, aliasedTable, countDistinct } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull, GraphQLScalarType, Kind, GraphQLObjectType, GraphQLInt, GraphQLError } from 'graphql';
import * as dbSchema from './schema';

export function createGraphQLSchema(db) {
    // Define a GraphQL JSON scalar type
    const GraphQLJSON = new GraphQLScalarType({
        name: 'JSON',
        description: 'The `JSON` scalar type represents JSON values as specified by ECMA-404',
        serialize(valueFromResolver) { // Value from resolver/DB output to client
            if (typeof valueFromResolver === 'string') {
                try {
                    return JSON.parse(valueFromResolver); // Ensure client gets a parsed object
                } catch (e) {
                    // If DB string isn't valid JSON or resolver returned non-JSON string for other reasons
                    // Log error and return null or throw, depending on desired strictness
                    console.error("GraphQLJSON.serialize: Error parsing string from resolver/DB: ", e);
                    return null; // Or throw new GraphQLError('Failed to serialize JSON from resolver.');
                }
            }
            // If it's already an object (e.g., Drizzle parsed it, or resolver built it), pass through.
            return valueFromResolver;
        },
        parseValue(inputValueFromClient) { // Value from client variables to resolver
            // Since the $links variable is JSON!, inputValueFromClient will be the JS object/array.
            // Drizzle's text({ mode: 'json' }) expects a string for insertion.
            try {
                return JSON.stringify(inputValueFromClient);
            } catch (e) {
                throw new GraphQLError('Failed to stringify JSON value for resolver: ' + e.message);
            }
        },
        parseLiteral(ast) { // Value from query literal to resolver
            // This helper converts an AST node to its JavaScript value, then stringifies it.
            function astToValue(node) {
                switch (node.kind) {
                    case Kind.STRING: // A string literal could be pre-stringified JSON or just a string
                        // For safety, if it's a string, try parsing. If it fails, it's not JSON.
                        // If it parses, it means it was a string *containing* JSON, which is unusual for a JSON literal.
                        // More commonly, for a JSON scalar, object/list literals are used.
                        // For now, assume a string literal IS the content, to be stringified if not already part of a larger structure.
                        // This part is tricky; typically one might expect ObjectValue or ListValue for JSON literals.
                        // If a string is passed, it implies it's a simple JSON string value like "\"my string\""
                        // or it is the *content* of what should be stringified.
                        // Let's assume it IS the JSON string content for Drizzle if it's a simple string literal.
                        try {
                            JSON.parse(node.value); // Validate if it's a JSON string
                            return node.value; // Return the string itself if it's already valid JSON string
                        } catch (e) {
                            // If it's not a valid JSON string, then it's a plain string to be encoded *as* a JSON string.
                            return JSON.stringify(node.value);
                        }
                    case Kind.BOOLEAN:
                        return node.value;
                    case Kind.INT:
                    case Kind.FLOAT:
                        return parseFloat(node.value);
                    case Kind.OBJECT:
                        return Object.fromEntries(node.fields.map(field => [field.name.value, astToValue(field.value)]));
                    case Kind.LIST:
                        return node.values.map(astToValue);
                    case Kind.NULL:
                        return null;
                    default:
                        return undefined; // Or throw for unhandled kinds
                }
            }
            const jsValue = astToValue(ast);
            if (typeof jsValue === 'undefined') {
                throw new GraphQLError('Could not parse literal to a valid JS value for JSON: ' + ast.kind);
            }
            // The resolver expects a string for Drizzle's text({ mode: 'json' })
            try {
                return JSON.stringify(jsValue);
            } catch (e) {
                throw new GraphQLError('Failed to stringify parsed literal for JSON: ' + e.message);
            }
        }
    });

    // Get the schema from drizzle-graphql
    const drizzleResult = buildSchema(db, {
        relationsDepthLimit: 4
    });

    // Add the JSON scalar type to the schema
    drizzleResult.schema._typeMap.JSON = GraphQLJSON;

    // Dynamically identify fields that are JSON in the Drizzle schema
    const fieldsToConvertToJSON = new Set();
    for (const tableName in dbSchema) {
        const table = dbSchema[tableName];
        if (table && typeof table === 'object' && table[Symbol.for('drizzle:BaseName')]) {
            // Iterate over the properties of the table object. These properties are the columns.
            for (const columnNameKey in table) {
                // Ensure we're looking at own properties and not from the prototype chain.
                const column = table[columnNameKey]; // This is the column definition object.
                if (column) {
                    if (column.config?.dataType === 'json')
                        fieldsToConvertToJSON.add(column.name || columnNameKey);

                }
            }
        }
    }


    // General approach to set specific fields to JSON type across all object types
    for (const type of Object.values(drizzleResult.schema._typeMap)) {
        // Check if it's a GraphQLObjectType and has fields
        if (type && type.getFields && typeof type.getFields === 'function' && type._fields) {
            for (const fieldName of fieldsToConvertToJSON) { // Iterate over the dynamically generated set
                if (type._fields[fieldName]) {
                    type._fields[fieldName].type = GraphQLJSON;
                }
            }
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

    // Define Payload type for ObjectsList
    const ObjectsListPayload = new GraphQLObjectType({
        name: 'ObjectsListPayload',
        fields: () => ({
            items: { type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.ObjectsSelectItem)) },
            totalCount: { type: GraphQLInt }
        })
    });
    drizzleResult.schema._typeMap.ObjectsListPayload = ObjectsListPayload;

    // Define Payload type for AssetsList
    const AssetsListPayload = new GraphQLObjectType({
        name: 'AssetsListPayload',
        fields: () => ({
            items: { type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.AssetsSelectItem)) },
            totalCount: { type: GraphQLInt }
        })
    });
    drizzleResult.schema._typeMap.AssetsListPayload = AssetsListPayload;

    // Add custom query for objects list
    drizzleResult.schema._typeMap.Query._fields.objectsList = {
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

    // Add custom query for assets list
    drizzleResult.schema._typeMap.Query._fields.assetsList = {
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
                inst_name_text_original_language: institutionNameTexts.original_language,
                inst_name_translations_json: sql`json_group_array(json_object('id', ${institutionNameTranslations.id}, 'language_code', ${institutionNameTranslations.language_code}, 'content', ${institutionNameTranslations.content}))`.append(sql`FILTER (WHERE ${institutionNameTranslations.id} IS NOT NULL)`).as('inst_name_translations_json'),

                // Project related fields
                proj_id: dbSchema.project.id,
                proj_title_text_id: projectTitleTexts.id,
                proj_title_text_content: projectTitleTexts.content,
                proj_title_text_original_language: projectTitleTexts.original_language,
                proj_title_translations_json: sql`json_group_array(json_object('id', ${projectTitleTranslations.id}, 'language_code', ${projectTitleTranslations.language_code}, 'content', ${projectTitleTranslations.content}))`.append(sql`FILTER (WHERE ${projectTitleTranslations.id} IS NOT NULL)`).as('proj_title_translations_json'),
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
                        original_language: item.inst_name_text_original_language,
                        translations: JSON.parse(item.inst_name_translations_json || '[]').filter(t => t && t.id !== null)
                    }
                } : null;

                const project = item.proj_id ? {
                    id: item.proj_id,
                    title: {
                        id: item.proj_title_text_id,
                        content: item.proj_title_text_content,
                        original_language: item.proj_title_text_original_language,
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

    return { schema: drizzleResult.schema, resolvers: drizzleResult.resolvers };
};




