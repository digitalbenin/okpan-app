import { sql, eq } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString, GraphQLInt } from 'graphql';
import * as dbSchema from '../schema';
import { GraphQLJSON } from './common';

const coercePrimary01 = (val) => {
    return val === true || val === 1 || val === '1' || val === 'true' ? 1 : 0;
};

const normalizeImportedValues = (value) => {
    const source = Array.isArray(value) ? value.flat(Infinity) : [value];

    return source
        .filter((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '')
        .map((entry) => String(entry).trim());
};

const getPrimaryValue = (value) => normalizeImportedValues(value)[0] || null;

const normalizeTemplateMapping = (mapping) => {
    if (!Array.isArray(mapping)) return [];
    const expanded = [];

    for (const m of mapping.filter(Boolean)) {
        const headerField = typeof m?.headerField === 'string' ? m.headerField : '';
        if (!headerField) continue;
        const primary01 = coercePrimary01(m?.primary);

        const ids = Array.isArray(m?.mappedFields)
            ? m.mappedFields.filter(Boolean)
            : (m?.mappedField !== undefined && m?.mappedField !== null)
                ? [m.mappedField]
                : [];

        if (!ids.length) {
            expanded.push({ headerField, mappedField: null, primary: primary01 });
            continue;
        }

        for (const id of ids) {
            expanded.push({ headerField, mappedField: id, primary: primary01 });
        }
    }

    // Ensure exactly one primary headerField across the whole mapping.
    // If multiple entries are primary, we keep the first headerField encountered and apply primary=1 to all of its entries.
    let primaryHeaderField = null;
    for (const m of expanded) {
        if (m.primary === 1) {
            primaryHeaderField = m.headerField;
            break;
        }
    }
    if (!primaryHeaderField && expanded.length) {
        primaryHeaderField = expanded[0].headerField;
    }
    if (primaryHeaderField) {
        for (const m of expanded) {
            m.primary = m.headerField === primaryHeaderField ? 1 : 0;
        }
    }

    return expanded;
};

export const createObjectImportMutation = (db, drizzleResult) => {
    // Define a lean result type that doesn't include potentially large arrays
    const ObjectImportResult = new GraphQLObjectType({
        name: 'ObjectImportResult',
        fields: () => ({
            template: { type: drizzleResult.schema._typeMap.TemplatesSelectItem },
            datasource: { type: drizzleResult.schema._typeMap.DatasourcesSelectItem },
            import: { type: drizzleResult.schema._typeMap.ImportsSelectItem },
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
                description: 'ID of the datasource to associate with the import'
            },
            {
                name: 'mapping',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.JSON),
                description: 'Array of mapping objects. Format: [{"headerField": "header name", "mappedField": "ontologyFieldId", "primary": 0/1}]'
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
                const normalizedMapping = normalizeTemplateMapping(parsedMapping);

                // Start a transaction
                return await db.transaction(async (tx) => {
                    const createdObjects = [];
                    const createdOntologyFields = [];
                    const createdObjectsDatasources = [];
                    let createdTemplate = null;
                    let createdImport = null;
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

                    // 2. Create the import record first (standalone)
                    const [importRecord] = await tx.insert(dbSchema.imports)
                        .values({
                            filename: sourceFileName || null,
                            data: data
                        })
                        .returning();
                    createdImport = importRecord;

                    // 3. Update datasource to link to the import
                    const datasourceUpdate = { import_id: createdImport.id };
                    if (sourceFileName) {
                        datasourceUpdate.source = sourceFileName;
                    }
                    
                    await tx.update(dbSchema.datasources)
                        .set(datasourceUpdate)
                        .where(eq(dbSchema.datasources.id, datasourceId));

                    // Get the updated datasource data
                    updatedDatasource = {
                        id: datasourceId,
                        import_id: createdImport.id,
                        source: sourceFileName || null,
                        updated_at: new Date().toISOString()
                    };

                    // 4. Create the template
                    const templateData = {
                        mapping: JSON.stringify(normalizedMapping),
                        project_id: projectId,
                        institution_id: datasource.institution_id || null,
                        asset_map_rule: assetMapRule || null
                    };

                    const [templateResult] = await tx.insert(dbSchema.templates)
                        .values(templateData)
                        .returning();

                    // Use the returned template data directly
                    createdTemplate = templateResult;

                    // 5. Create objects from data array
                    for (const [index, rawDataRow] of data.entries()) {
                        try {
                            // Parse data row if it's a string
                            const dataRow = typeof rawDataRow === 'string' ? JSON.parse(rawDataRow) : rawDataRow;

                            // Determine the primary identifier value chosen by the user mapping
                            let primaryValue = null;
                            for (const m of normalizedMapping) {
                                if (m && m.primary === 1 && m.headerField) {
                                    const v = dataRow[m.headerField];
                                    const normalizedPrimaryValue = getPrimaryValue(v);
                                    if (normalizedPrimaryValue) {
                                        primaryValue = normalizedPrimaryValue;
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

                            // 6. Create objects_datasources junction record (tracks object-datasource-template relationship)
                            const [objectDatasourceResult] = await tx.insert(dbSchema.objects_datasources)
                                .values({
                                    object_id: objectResult.id,
                                    datasource_id: datasourceId,
                                    template_id: createdTemplate.id
                                })
                                .returning();
                            createdObjectsDatasources.push(objectDatasourceResult);

                            // 7. Create object-ontology field associations based on mapping
                            for (const fieldMapping of normalizedMapping) {
                                // Skip if no mapping defined or no headerField
                                if (!fieldMapping || !fieldMapping.headerField) {
                                    continue;
                                }

                                const values = normalizeImportedValues(dataRow[fieldMapping.headerField]);
                                if (!values.length) {
                                    continue;
                                }

                                for (const value of values) {
                                    const mappedFieldId = fieldMapping.mappedField;
                                    const associationData = {
                                        object_id: objectResult.id,
                                        field_id: mappedFieldId || null,
                                        datasources_id: datasourceId,
                                        value,
                                        primary: fieldMapping.primary === 1 ? 1 : 0,
                                        label: fieldMapping.headerField,
                                        default_description: null
                                    };

                                    const [ontologyFieldResult] = await tx.insert(dbSchema.objects_ontology_fields)
                                        .values(associationData)
                                        .returning();

                                    createdOntologyFields.push(ontologyFieldResult);
                                }
                            }

                        } catch (objectError) {
                            console.error(`Error creating object ${index + 1}:`, objectError);
                            throw objectError;
                        }
                    }

                    return {
                        template: createdTemplate,
                        datasource: updatedDatasource,
                        import: createdImport,
                        objects: createdObjects,
                        createdObjectsCount: createdObjects.length,
                        // Store the ontology fields data for action processing but don't return in response
                        _ontologyFields: createdOntologyFields,
                        _objectsDatasources: createdObjectsDatasources,
                        _import: createdImport
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
                import: { type: drizzleResult.schema._typeMap.ImportsSelectItem },
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
                description: 'ID of the datasource to associate with the import'
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
                    const createdObjectsDatasources = [];
                    let createdImport = null;

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

                    const normalizedMapping = normalizeTemplateMapping(parsedMapping);

                    // 3. Create the import record first (standalone)
                    const [importRecord] = await tx.insert(dbSchema.imports)
                        .values({
                            filename: sourceFileName || null,
                            data: data
                        })
                        .returning();
                    createdImport = importRecord;

                    // 4. Update datasource to link to the import
                    const datasourceUpdate = { import_id: createdImport.id };
                    if (sourceFileName) {
                        datasourceUpdate.source = sourceFileName;
                    }
                    
                    await tx.update(dbSchema.datasources)
                        .set(datasourceUpdate)
                        .where(eq(dbSchema.datasources.id, datasourceId));

                    const updatedDatasource = {
                        id: datasourceId,
                        import_id: createdImport.id,
                        source: sourceFileName || null,
                        updated_at: new Date().toISOString()
                    };

                    // 5. Create objects from data array
                    for (const [index, rawDataRow] of data.entries()) {
                        try {
                            const dataRow = typeof rawDataRow === 'string' ? JSON.parse(rawDataRow) : rawDataRow;

                            // Determine the primary identifier value chosen by the user mapping
                            let primaryValue = null;
                            for (const m of normalizedMapping) {
                                if (m && m.primary === 1 && m.headerField) {
                                    const v = dataRow[m.headerField];
                                    const normalizedPrimaryValue = getPrimaryValue(v);
                                    if (normalizedPrimaryValue) {
                                        primaryValue = normalizedPrimaryValue;
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

                            // 6. Create objects_datasources junction record (tracks object-datasource-template relationship)
                            const [objectDatasourceResult] = await tx.insert(dbSchema.objects_datasources)
                                .values({
                                    object_id: objectResult.id,
                                    datasource_id: datasourceId,
                                    template_id: template.id
                                })
                                .returning();
                            createdObjectsDatasources.push(objectDatasourceResult);

                            // 7. Create object-ontology field associations based on mapping
                            for (const fieldMapping of normalizedMapping) {
                                if (!fieldMapping || !fieldMapping.headerField) {
                                    continue;
                                }

                                const values = normalizeImportedValues(dataRow[fieldMapping.headerField]);
                                if (!values.length) {
                                    continue;
                                }

                                for (const value of values) {
                                    const associationData = {
                                        object_id: objectResult.id,
                                        field_id: fieldMapping.mappedField || null,
                                        datasources_id: datasourceId,
                                        value,
                                        primary: fieldMapping.primary === 1 ? 1 : 0,
                                        label: fieldMapping.headerField,
                                        default_description: null
                                    };

                                    const [ontologyFieldResult] = await tx.insert(dbSchema.objects_ontology_fields)
                                        .values(associationData)
                                        .returning();

                                    createdOntologyFields.push(ontologyFieldResult);
                                }
                            }

                        } catch (objectError) {
                            console.error(`Error creating object ${index + 1}:`, objectError);
                            throw objectError;
                        }
                    }

                    return {
                        template: template, // returning existing template (action logging will ignore CREATE)
                        datasource: updatedDatasource,
                        import: createdImport,
                        objects: createdObjects,
                        createdObjectsCount: createdObjects.length,
                        _ontologyFields: createdOntologyFields,
                        _objectsDatasources: createdObjectsDatasources,
                        _import: createdImport
                    };
                });

            } catch (error) {
                console.error('Error in objectImportUsingTemplate mutation:', error);
                throw new Error(`Import using template failed: ${error.message}`);
            }
        }
    };
};