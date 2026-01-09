import { eq, inArray } from 'drizzle-orm';
import { GraphQLNonNull, GraphQLObjectType } from 'graphql';
import * as dbSchema from '../schema.js';

/**
 * Custom mutation to update a template and propagate the changes to all objects using that template.
 * This updates objects_ontology_fields.field_id based on matching labels with the new template mapping.
 */
export const createUpdateTemplateAndPropagateMutation = (db, drizzleResult) => {
    // Define the return type
    const TemplatePropagationResult = new GraphQLObjectType({
        name: 'TemplatePropagationResult',
        fields: {
            updatedTemplate: { 
                type: drizzleResult.schema._typeMap.TemplatesSelectItem,
                description: 'The updated template'
            },
            affectedObjects: { 
                type: drizzleResult.schema._typeMap.Int,
                description: 'Number of objects affected by this change'
            },
            updatedFields: { 
                type: drizzleResult.schema._typeMap.Int,
                description: 'Number of ontology fields updated'
            }
        }
    });

    // Register the type in the schema map (matches patterns used by other custom queries/mutations)
    drizzleResult.schema._typeMap.TemplatePropagationResult = TemplatePropagationResult;

    return {
        name: 'updateTemplateAndPropagate',
        type: TemplatePropagationResult,
        args: [
            { name: 'templateId', type: new GraphQLNonNull(drizzleResult.schema._typeMap.String) },
            { name: 'name', type: drizzleResult.schema._typeMap.String },
            { name: 'mapping', type: new GraphQLNonNull(drizzleResult.schema._typeMap.JSON) },
            { name: 'institutionId', type: drizzleResult.schema._typeMap.String },
            { name: 'assetMapRule', type: drizzleResult.schema._typeMap.String }
        ],
        resolve: async (parent, args, context) => {
            const { templateId, name, mapping, institutionId, assetMapRule } = args;

            return await db.transaction(async (tx) => {
                // 1. Update the template
                const updateData = {};
                if (name !== undefined) updateData.name = name;
                if (mapping !== undefined) updateData.mapping = mapping;
                if (institutionId !== undefined) updateData.institution_id = institutionId;
                if (assetMapRule !== undefined) updateData.asset_map_rule = assetMapRule;
                const [updatedTemplate] = await tx
                    .update(dbSchema.templates)
                    .set(updateData)
                    .where(eq(dbSchema.templates.id, templateId))
                    .returning();

                if (!updatedTemplate) {
                    throw new Error(`Template ${templateId} not found`);
                }

                // 2. Parse the new mapping to create a label -> field_id map
                let parsedMapping = mapping;
                if (typeof mapping === 'string') {
                    try {
                        parsedMapping = JSON.parse(mapping);
                    } catch (e) {
                        throw new Error('Invalid mapping JSON');
                    }
                }

                if (!Array.isArray(parsedMapping)) {
                    throw new Error('Mapping must be an array');
                }

                // Build mapping: label (institutionField/headerField) -> field_id (mappedField)
                // Also track primary field
                const labelToFieldMap = new Map();
                let primaryLabel = null;

                for (const entry of parsedMapping) {
                    if (!entry || !entry.headerField) continue;
                    const label = entry.headerField.trim();
                    if (!label) continue;

                    // For each label, store the field_id (can be null for unmapped fields)
                    labelToFieldMap.set(label, entry.mappedField || null);

                    // Track which field is primary
                    if (entry.primary === 1 || entry.primary === true) {
                        primaryLabel = label;
                    }
                }

                // 3. Find all objects using this template (via objects_datasources junction)
                const objectDatasources = await tx
                    .select({ 
                        object_id: dbSchema.objects_datasources.object_id,
                        datasource_id: dbSchema.objects_datasources.datasource_id
                    })
                    .from(dbSchema.objects_datasources)
                    .where(eq(dbSchema.objects_datasources.template_id, templateId));

                if (objectDatasources.length === 0) {
                    // No objects use this template, just return the updated template
                    return {
                        updatedTemplate,
                        affectedObjects: 0,
                        updatedFields: 0
                    };
                }

                const affectedObjectIds = [...new Set(objectDatasources.map(od => od.object_id))];
                const datasourceIds = [...new Set(objectDatasources.map(od => od.datasource_id))];

                // 4. Get all ontology fields for these objects with these datasources
                const existingFields = await tx
                    .select()
                    .from(dbSchema.objects_ontology_fields)
                    .where(
                        inArray(dbSchema.objects_ontology_fields.object_id, affectedObjectIds)
                    );

                // Filter to only fields associated with datasources using this template
                const relevantFields = existingFields.filter(f => 
                    datasourceIds.includes(f.datasources_id)
                );

                console.log(`Found ${relevantFields.length} ontology fields to potentially update`);

                // 5. Update each field's field_id and primary flag based on the new mapping
                let updatedFieldsCount = 0;

                for (const field of relevantFields) {
                    if (!field.label) continue; // Skip fields without labels

                    const newFieldId = labelToFieldMap.get(field.label);
                    const newPrimary = (field.label === primaryLabel) ? 1 : 0;

                    // Only update if something changed
                    const fieldIdChanged = field.field_id !== newFieldId;
                    const primaryChanged = field.primary !== newPrimary;

                    if (fieldIdChanged || primaryChanged) {
                        await tx
                            .update(dbSchema.objects_ontology_fields)
                            .set({
                                field_id: newFieldId,
                                primary: newPrimary
                            })
                            .where(eq(dbSchema.objects_ontology_fields.id, field.id));

                        updatedFieldsCount++;
                    }
                }

                console.log(`Updated ${updatedFieldsCount} ontology fields across ${affectedObjectIds.length} objects`);

                return {
                    updatedTemplate,
                    affectedObjects: affectedObjectIds.length,
                    updatedFields: updatedFieldsCount
                };
            });
        }
    };
};
