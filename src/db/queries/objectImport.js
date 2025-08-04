import { sql, eq } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString, GraphQLInt } from 'graphql';
import * as dbSchema from '../schema';
import { GraphQLJSON } from './common';

export const createObjectImportMutation = (db, drizzleResult) => {
    // Define a lean result type that doesn't include potentially large arrays
    const ObjectImportResult = new GraphQLObjectType({
        name: 'ObjectImportResult',
        fields: () => ({
            template: { type: drizzleResult.schema._typeMap.TemplatesSelectItem },
            datasource: { type: drizzleResult.schema._typeMap.DatasourcesSelectItem },
            objects: { type: new GraphQLList(drizzleResult.schema._typeMap.ObjectsSelectItem) },
            createdObjectsCount: { type: GraphQLInt }
        })
    });

    // Add the type to the schema
    drizzleResult.schema._typeMap.ObjectImportResult = ObjectImportResult;

    return {
        name: 'objectImport',
        type: ObjectImportResult,
        args: [
            {
                name: 'datasourceId',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.String),
                description: 'ID of the datasource to associate with the template'
            },
            {
                name: 'mapping',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.JSON),
                description: 'Array of mapping objects. Format: [{"headerField": "header name", "mappedField": "ontologyFieldId", "primary": boolean}]'
            },
            {
                name: 'data',
                type: new GraphQLNonNull(new GraphQLList(drizzleResult.schema._typeMap.JSON)),
                description: 'Array of data objects to import, where each object has header names as keys'
            },
            {
                name: 'assetMapRule',
                type: drizzleResult.schema._typeMap.String,
                description: 'Optional asset mapping rule for the template'
            }
        ],
        resolve: async (source, args, context) => {
            const { datasourceId, mapping, data, assetMapRule } = args;

            try {
                // Parse mapping if it's a string
                const parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;

                // Start a transaction
                return await db.transaction(async (tx) => {
                    const createdObjects = [];
                    const createdOntologyFields = [];
                    let createdTemplate = null;
                    let updatedDatasource = null;

                    // 1. Verify datasource exists and get project_id
                    const datasource = await tx.query.datasources.findFirst({
                        where: eq(dbSchema.datasources.id, datasourceId),
                        with: {
                            institution: true
                        }
                    });

                    if (!datasource) {
                        throw new Error(`Datasource with ID ${datasourceId} not found`);
                    }

                    const projectId = datasource?.institution?.project_id;
                    if (!projectId) {
                        throw new Error('Could not determine project ID from datasource');
                    }

                    // 2. Create the template
                    const templateData = {
                        mapping: JSON.stringify(parsedMapping),
                        project_id: projectId,
                        asset_map_rule: assetMapRule || null
                    };

                    const [templateResult] = await tx.insert(dbSchema.templates)
                        .values(templateData)
                        .returning();

                    // Use the returned template data directly
                    createdTemplate = templateResult;

                    // 3. Associate datasource with the template
                    await tx.update(dbSchema.datasources)
                        .set({ template_id: createdTemplate.id })
                        .where(eq(dbSchema.datasources.id, datasourceId));

                    // Get the updated datasource data
                    updatedDatasource = {
                        id: datasourceId,
                        template_id: createdTemplate.id,
                        updated_at: new Date().toISOString()
                    };

                    // 4. Create objects from data array
                    for (const [index, rawDataRow] of data.entries()) {
                        try {
                            // Parse data row if it's a string
                            const dataRow = typeof rawDataRow === 'string' ? JSON.parse(rawDataRow) : rawDataRow;
                            // Create the object
                            const objectData = {
                                project_id: projectId,
                                institution_id: datasource.institution_id,
                                status: 'in progress'
                            };

                            const [objectResult] = await tx.insert(dbSchema.objects)
                                .values(objectData)
                                .returning();

                            // Use the returned object data directly
                            createdObjects.push(objectResult);

                            // 5. Create object-ontology field associations based on mapping
                            for (const fieldMapping of parsedMapping) {
                                // Skip if no mapping defined or no headerField
                                if (!fieldMapping || !fieldMapping.headerField) {
                                    continue;
                                }

                                const value = dataRow[fieldMapping.headerField];
                                // Skip if no value in the data
                                if (value === undefined || value === null || value === '') {
                                    continue;
                                }

                                // Create the object-ontology field association
                                // If mappedField is null, field_id will be null (unmapped field)
                                const associationData = {
                                    object_id: objectResult.id,
                                    field_id: fieldMapping.mappedField || null, // Allow null field_id for unmapped fields
                                    datasources_id: datasourceId,
                                    value: String(value), // Convert to string
                                    primary: fieldMapping.primary ? 1 : 0, // Convert boolean to integer for SQLite
                                    label: fieldMapping.headerField, // Use header field name as label
                                    default_description: null
                                };

                                const [ontologyFieldResult] = await tx.insert(dbSchema.objects_ontology_fields)
                                    .values(associationData)
                                    .returning();

                                // Use the returned ontology field data directly
                                createdOntologyFields.push(ontologyFieldResult);
                            }

                        } catch (objectError) {
                            console.error(`Error creating object ${index + 1}:`, objectError);
                            throw objectError;
                        }
                    }

                    return {
                        template: createdTemplate,
                        datasource: updatedDatasource,
                        objects: createdObjects,
                        createdObjectsCount: createdObjects.length,
                        // Store the ontology fields data for action processing but don't return in response
                        _ontologyFields: createdOntologyFields
                    };
                });

            } catch (error) {
                console.error('Error in objectImport mutation:', error);
                throw new Error(`Import failed: ${error.message}`);
            }
        }
    };
};
