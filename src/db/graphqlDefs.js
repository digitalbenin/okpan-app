import { buildSchema } from 'drizzle-graphql';
import * as dbSchema from './schema';
import {
    GraphQLJSON,
    createProjectsListQuery,
    createProjectByIdQuery,
    createInstitutionsListQuery,
    createInstitutionsCountQuery,
    createInstitutionByIdQuery,
    createInstitutionsBulkUpdateMutation,
    createInstitutionsBulkDeleteMutation,
    createDatasourcesListQuery,
    createObjectsListQuery,
    createObjectsByDatasourceQuery,
    createAssetsListQuery,
    createEntitySearchQuery,
    createObjectDisplayFieldsTransformedQuery,
    createObjectSearchQuery,
    createObjectImportMutation,
    createObjectImportUsingTemplateMutation,
    createResearchFieldObjectsCountQuery,
    createProjectCreateMutation,
    createAssetsObjectsBulkLinkMutation,
    createAssetsBulkDeleteMutation,
    createObjectsOntologyFieldsUnlinkMutation
} from './queries';

export function createGraphQLSchema(db) {
    // Get the schema from drizzle-graphql
    const drizzleResult = buildSchema(db, {
        relationsDepthLimit: 4
    });

    // Store the drizzle type mappings in the schema for later use
    // Extract type to table mapping from the actual GraphQL type names
    const typeToTableMap = {};
    for (const typeName in drizzleResult.schema._typeMap) {
        if (typeName.endsWith('Item') || typeName.endsWith('SelectItem')) {
            // Extract table name from type name
            let tableName = typeName.replace(/SelectItem$|Item$/, '');

            // Convert camelCase to snake_case for table names
            // GenericAssets -> generic_assets, InterfaceLanguages -> interface_languages
            tableName = tableName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

            typeToTableMap[typeName] = tableName;
        }
    }

    drizzleResult.schema._drizzleTypes = typeToTableMap;

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



    // Add custom queries using the modular query functions
    drizzleResult.schema._typeMap.Query._fields.projectsList = createProjectsListQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.projectById = createProjectByIdQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.institutionsList = createInstitutionsListQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.institutionsCount = createInstitutionsCountQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.institutionById = createInstitutionByIdQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.datasourcesList = createDatasourcesListQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.objectsList = createObjectsListQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.objectsByDatasource = createObjectsByDatasourceQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.assetsList = createAssetsListQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.entitySearch = createEntitySearchQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.objectDisplayFieldsTransformed = createObjectDisplayFieldsTransformedQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.objectSearch = createObjectSearchQuery(db, drizzleResult);
    drizzleResult.schema._typeMap.Query._fields.researchFieldObjectsCount = createResearchFieldObjectsCountQuery(db, drizzleResult);

    // Add custom bulk mutations
    drizzleResult.schema._typeMap.Mutation._fields.bulkUpdateInstitutions = createInstitutionsBulkUpdateMutation(db, drizzleResult);
    drizzleResult.schema._typeMap.Mutation._fields.bulkDeleteInstitutions = createInstitutionsBulkDeleteMutation(db, drizzleResult);
    drizzleResult.schema._typeMap.Mutation._fields.objectImport = createObjectImportMutation(db, drizzleResult);
    drizzleResult.schema._typeMap.Mutation._fields.objectImportUsingTemplate = createObjectImportUsingTemplateMutation(db, drizzleResult);
    // New consolidated project creation mutation
    drizzleResult.schema._typeMap.Mutation._fields.createProjectWithDefaults = createProjectCreateMutation(db, drizzleResult);
    // Bulk link assets to objects
    drizzleResult.schema._typeMap.Mutation._fields.linkAssetsToObjectsBulk = createAssetsObjectsBulkLinkMutation(db, drizzleResult);
    // Bulk delete assets and clean filesystem
    drizzleResult.schema._typeMap.Mutation._fields.deleteAssetsBulk = createAssetsBulkDeleteMutation(db, drizzleResult);
    // Unlink datasource from object
    drizzleResult.schema._typeMap.Mutation._fields.unlinkDatasourceFromObject = createObjectsOntologyFieldsUnlinkMutation(db, drizzleResult);

    return { schema: drizzleResult.schema, resolvers: drizzleResult.resolvers };
};




