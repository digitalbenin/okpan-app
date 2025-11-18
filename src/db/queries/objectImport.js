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
            },
            {
                name: 'sourceFileName',
                type: drizzleResult.schema._typeMap.String,
                description: 'Optional source file name to store in datasource'
            }
        ],
        resolve: async (source, args, context) => {
            const { datasourceId, mapping, data, assetMapRule, sourceFileName } = args;

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
                    const datasourceUpdate = { template_id: createdTemplate.id };
                    if (sourceFileName) {
                        datasourceUpdate.source = sourceFileName;
                    }
                    
                    await tx.update(dbSchema.datasources)
                        .set(datasourceUpdate)
                        .where(eq(dbSchema.datasources.id, datasourceId));

                    // Get the updated datasource data
                    updatedDatasource = {
                        id: datasourceId,
                        template_id: createdTemplate.id,
                        source: sourceFileName || null,
                        updated_at: new Date().toISOString()
                    };

                    // 4. Create objects from data array
                    for (const [index, rawDataRow] of data.entries()) {
                        try {
                            // Parse data row if it's a string
                            const dataRow = typeof rawDataRow === 'string' ? JSON.parse(rawDataRow) : rawDataRow;

                            // Determine the primary identifier value chosen by the user mapping
                            let primaryValue = null;
                            for (const m of parsedMapping) {
                                if (m && m.primary && m.headerField) {
                                    const v = dataRow[m.headerField];
                                    if (v !== undefined && v !== null && String(v).trim() !== '') {
                                        primaryValue = String(v);
                                        break;
                                    }
                                }
                            }
                            // Create the object
                            const objectData = {
                                project_id: projectId,
                                institution_id: datasource.institution_id,
                                status: 'in progress',
                                name: primaryValue || null
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

// New mutation: import objects using an existing template (reuse mapping)
export const createObjectImportUsingTemplateMutation = (db, drizzleResult) => {
    // Reuse the ObjectImportResult type if already defined; otherwise define it
    let ObjectImportResult = drizzleResult.schema._typeMap.ObjectImportResult;
    if (!ObjectImportResult) {
        ObjectImportResult = new GraphQLObjectType({
            name: 'ObjectImportResult',
            fields: () => ({
                template: { type: drizzleResult.schema._typeMap.TemplatesSelectItem },
                datasource: { type: drizzleResult.schema._typeMap.DatasourcesSelectItem },
                objects: { type: new GraphQLList(drizzleResult.schema._typeMap.ObjectsSelectItem) },
                createdObjectsCount: { type: GraphQLInt }
            })
        });
        drizzleResult.schema._typeMap.ObjectImportResult = ObjectImportResult;
    }

    return {
        name: 'objectImportUsingTemplate',
        type: ObjectImportResult,
        args: [
            {
                name: 'datasourceId',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.String),
                description: 'ID of the datasource to associate with the existing template'
            },
            {
                name: 'templateId',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.String),
                description: 'ID of the existing template to reuse'
            },
            {
                name: 'data',
                type: new GraphQLNonNull(new GraphQLList(drizzleResult.schema._typeMap.JSON)),
                description: 'Array of data objects to import, where each object has header names as keys'
            },
            {
                name: 'sourceFileName',
                type: drizzleResult.schema._typeMap.String,
                description: 'Optional source file name to store in datasource'
            }
        ],
        resolve: async (source, args, context) => {
            const { datasourceId, templateId, data, sourceFileName } = args;

            try {
                return await db.transaction(async (tx) => {
                    const createdObjects = [];
                    const createdOntologyFields = [];

                    // 1. Verify datasource exists and get project_id
                    const datasource = await tx.query.datasources.findFirst({
                        where: eq(dbSchema.datasources.id, datasourceId),
                        with: { institution: true }
                    });

                    if (!datasource) {
                        throw new Error(`Datasource with ID ${datasourceId} not found`);
                    }

                    const projectId = datasource?.institution?.project_id;
                    if (!projectId) {
                        throw new Error('Could not determine project ID from datasource');
                    }

                    // 2. Load and validate template
                    const template = await tx.query.templates.findFirst({
                        where: eq(dbSchema.templates.id, templateId)
                    });

                    if (!template) {
                        throw new Error(`Template with ID ${templateId} not found`);
                    }

                    if (template.project_id !== projectId) {
                        throw new Error('Template project does not match datasource project');
                    }

                    // Parse mapping stored on template
                    let parsedMapping;
                    try {
                        parsedMapping = typeof template.mapping === 'string' ? JSON.parse(template.mapping) : template.mapping;
                    } catch (e) {
                        throw new Error('Invalid mapping JSON on template');
                    }

                    if (!Array.isArray(parsedMapping)) {
                        throw new Error('Template mapping must be an array');
                    }

                    // 3. Associate datasource with the template (idempotent)
                    const datasourceUpdate = { template_id: template.id };
                    if (sourceFileName) {
                        datasourceUpdate.source = sourceFileName;
                    }
                    
                    await tx.update(dbSchema.datasources)
                        .set(datasourceUpdate)
                        .where(eq(dbSchema.datasources.id, datasourceId));

                    const updatedDatasource = {
                        id: datasourceId,
                        template_id: template.id,
                        source: sourceFileName || null,
                        updated_at: new Date().toISOString()
                    };

                    // 4. Create objects from data array (same logic as objectImport)
                    for (const [index, rawDataRow] of data.entries()) {
                        try {
                            const dataRow = typeof rawDataRow === 'string' ? JSON.parse(rawDataRow) : rawDataRow;

                            // Determine the primary identifier value chosen by the user mapping
                            let primaryValue = null;
                            for (const m of parsedMapping) {
                                if (m && m.primary && m.headerField) {
                                    const v = dataRow[m.headerField];
                                    if (v !== undefined && v !== null && String(v).trim() !== '') {
                                        primaryValue = String(v);
                                        break;
                                    }
                                }
                            }
                            const objectData = {
                                project_id: projectId,
                                institution_id: datasource.institution_id,
                                status: 'in progress',
                                name: primaryValue || null
                            };

                            const [objectResult] = await tx.insert(dbSchema.objects)
                                .values(objectData)
                                .returning();

                            createdObjects.push(objectResult);

                            for (const fieldMapping of parsedMapping) {
                                if (!fieldMapping || !fieldMapping.headerField) {
                                    continue;
                                }

                                const value = dataRow[fieldMapping.headerField];
                                if (value === undefined || value === null || value === '') {
                                    continue;
                                }

                                const associationData = {
                                    object_id: objectResult.id,
                                    field_id: fieldMapping.mappedField || null,
                                    datasources_id: datasourceId,
                                    value: String(value),
                                    primary: fieldMapping.primary ? 1 : 0,
                                    label: fieldMapping.headerField,
                                    default_description: null
                                };

                                const [ontologyFieldResult] = await tx.insert(dbSchema.objects_ontology_fields)
                                    .values(associationData)
                                    .returning();

                                createdOntologyFields.push(ontologyFieldResult);
                            }

                        } catch (objectError) {
                            console.error(`Error creating object ${index + 1}:`, objectError);
                            throw objectError;
                        }
                    }

                    return {
                        template: template, // returning existing template (action logging will ignore CREATE)
                        datasource: updatedDatasource,
                        objects: createdObjects,
                        createdObjectsCount: createdObjects.length,
                        _ontologyFields: createdOntologyFields
                    };
                });

            } catch (error) {
                console.error('Error in objectImportUsingTemplate mutation:', error);
                throw new Error(`Import using template failed: ${error.message}`);
            }
        }
    };
};