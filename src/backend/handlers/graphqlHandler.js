// GraphQL handler with action logging
import { graphql, parse } from 'graphql';
import { and } from 'drizzle-orm';
import { actions } from '../../db/schema.js';
import { getClientId } from '../../db/init.js';
import {
    generateActionMetadata,
    JUNCTION_TABLE_TYPES,
    IGNORED_FIELDS_FOR_CHANGES,
    UUID_REGEX,
    VARIABLE_NAME_MAPPINGS,
    JUNCTION_RELATION_EXTRACTORS,
    ENTITIES_WITH_PROJECT_ID,
    ENTITIES_WITH_INDIRECT_PROJECT_ID,
    TEXT_PARENT_QUERIES,
    TEXT_FIELD_ID_VARIABLES,
    getPrimaryEntityFromActions,
    getParentActionType
} from '../services/actionService.js';

// Simple utility functions
const isBulkOp = (name) => name.toLowerCase().includes('bulk');
const isUpdate = (name) => name.toLowerCase().includes('update');
const isDelete = (name) => name.toLowerCase().includes('delete');
const isCreate = (name) => name.toLowerCase().includes('create') || name.toLowerCase().startsWith('insertinto');

const parseJsonVar = (variable) => {
    if (typeof variable === 'string') {
        try { return JSON.parse(variable); } catch { return variable; }
    }
    if (Array.isArray(variable) && variable.length === 1 && typeof variable[0] === 'string') {
        try { return JSON.parse(variable[0]); } catch { return variable; }
    }
    return variable;
};

const extractMutationFields = (op) =>
    op?.selectionSet?.selections?.filter(s => s.kind === 'Field')?.map(s => s.name.value) ?? [];

const getMutationInfo = (fieldName, schema) => {
    const mutationType = schema.getType('Mutation');
    const field = mutationType.getFields()[fieldName];

    let returnType = field.type;
    while (returnType.ofType) returnType = returnType.ofType;

    const entityType = schema._drizzleTypes?.[returnType.name] || 'unknown';
    const lowerName = fieldName.toLowerCase();

    let actionType = 'CREATE';
    if (lowerName.includes('delete')) actionType = 'DELETE';
    else if (lowerName.includes('update')) actionType = 'UPDATE';

    return { actionType, entityType };
};

const findEntityIdInVars = (variables) =>
    Object.values(variables).find(v => typeof v === 'string' && v.match(UUID_REGEX));

const getVariableValue = (variables, ...possibleNames) => {
    for (const name of possibleNames) {
        if (variables[name]) return variables[name];
    }
    return null;
};

// Extract project ID from variables or entity data
const extractProjectId = async (variables, entityType, entityId, db, preData = null) => {
    // Try variables first
    const fromVars = getVariableValue(variables, 'projectId', 'project_id');
    if (fromVars) return fromVars;

    // Try pre-execution data
    if (preData?.project_id) return preData.project_id;
    if (preData?.object?.project_id) return preData.object.project_id;

    // Database lookups with error handling
    try {
        // For junction tables via object lookup
        if (JUNCTION_TABLE_TYPES.includes(entityType)) {
            if (preData?.object_id) {
                const object = await db.query.objects.findFirst({
                    where: (e, { eq }) => eq(e.id, preData.object_id)
                });
                if (object?.project_id) return object.project_id;
            }

            if (entityId) {
                const junction = await JUNCTION_RELATION_EXTRACTORS[entityType]?.(db, entityId);
                if (junction?.object?.project_id) return junction.object.project_id;
            }
        }

        // For regular entities with project_id
        if (entityId && ENTITIES_WITH_PROJECT_ID.includes(entityType)) {
            const entity = await db.query[entityType]?.findFirst({
                where: (e, { eq }) => eq(e.id, entityId)
            });
            if (entity?.project_id) return entity.project_id;
        }

        // Special case: datasources get project_id via their institution
        if (ENTITIES_WITH_INDIRECT_PROJECT_ID.includes(entityType) && entityId) {
            if (entityType === 'datasources') {
                const datasource = await db.query.datasources.findFirst({
                    where: (e, { eq }) => eq(e.id, entityId),
                    with: { institution: true }
                });
                if (datasource?.institution?.project_id) return datasource.institution.project_id;
            }
        }

        // For text entities, find their parent entity and get project_id from there
        if (entityType === 'texts' && entityId) {
            for (const { table, fields } of TEXT_PARENT_QUERIES) {
                for (const field of fields) {
                    const parent = await db.query[table]?.findFirst({
                        where: (entity, { eq }) => eq(entity[field], entityId)
                    });
                    if (parent) {
                        // Special case: if parent is a project, use its id as project_id
                        if (table === 'project') return parent.id;
                        // Special case: if parent is a datasource, get project_id via institution
                        if (table === 'datasources') {
                            const datasourceWithInstitution = await db.query.datasources.findFirst({
                                where: (e, { eq }) => eq(e.id, parent.id),
                                with: { institution: true }
                            });
                            if (datasourceWithInstitution?.institution?.project_id) {
                                return datasourceWithInstitution.institution.project_id;
                            }
                        }
                        // For other entities, use their project_id field
                        if (parent.project_id) return parent.project_id;
                    }
                }
            }
        }

        // For translation entities, find their text parent and then the text's parent
        if (entityType === 'translations' && entityId) {
            const translation = await db.query.translations.findFirst({
                where: (entity, { eq }) => eq(entity.id, entityId)
            });
            if (translation?.text_id) {
                // Recursively call for the text entity
                return await extractProjectId({}, 'texts', translation.text_id, db);
            }
        }
    } catch (error) {
        console.error(`Error extracting project ID for ${entityType}:`, error);
    }

    return null;
};

const findJunctionId = async (entityType, variables, db) => {
    try {
        let record = null;
        if (entityType === 'objects_assets') {
            const objectId = getVariableValue(variables, ...VARIABLE_NAME_MAPPINGS.objectId);
            const assetId = getVariableValue(variables, ...VARIABLE_NAME_MAPPINGS.assetId);

            if (objectId && assetId) {
                record = await db.query.objects_assets.findFirst({
                    where: (e, { eq }) => and(eq(e.object_id, objectId), eq(e.asset_id, assetId))
                });
            }
        } else if (entityType === 'objects_research_fields') {
            const objectId = getVariableValue(variables, ...VARIABLE_NAME_MAPPINGS.objectId);
            const fieldId = getVariableValue(variables, ...VARIABLE_NAME_MAPPINGS.fieldId);

            if (objectId && fieldId) {
                record = await db.query.objects_research_fields.findFirst({
                    where: (e, { eq }) => and(eq(e.object_id, objectId), eq(e.field_id, fieldId))
                });
            }
        } else if (entityType === 'assets_institutions') {
            const assetId = getVariableValue(variables, ...VARIABLE_NAME_MAPPINGS.assetId);
            const institutionId = getVariableValue(variables, ...VARIABLE_NAME_MAPPINGS.institutionId);

            if (assetId && institutionId) {
                record = await db.query.assets_institutions.findFirst({
                    where: (e, { eq }) => and(eq(e.asset_id, assetId), eq(e.institution_id, institutionId))
                });
            }
        }
        return record?.id || null;
    } catch { return null; }
};

const findEntityInTables = async (entityId, db) => {
    const tableNames = Object.keys(db.query);
    for (const tableName of tableNames) {
        try {
            const found = await db.query[tableName].findFirst({
                where: (e, { eq }) => eq(e.id, entityId)
            });
            if (found) return found;
        } catch { continue; }
    }
    return null;
};

// Get changed fields for updates
const getChangedFields = (variables, before, after) => {
    if (!before || !after) return variables;

    const afterEntity = Array.isArray(after) ? after[0] : after;
    const changes = {};

    for (const fieldName in afterEntity) {
        if (IGNORED_FIELDS_FOR_CHANGES.includes(fieldName)) continue;

        const beforeValue = before[fieldName];
        const afterValue = afterEntity[fieldName];

        let normalizedBefore = beforeValue;
        if (typeof beforeValue === 'string' && (beforeValue.startsWith('[') || beforeValue.startsWith('{'))) {
            try { normalizedBefore = JSON.parse(beforeValue); } catch { /* ignore */ }
        }

        if (JSON.stringify(normalizedBefore) !== JSON.stringify(afterValue)) {
            for (const [varName, varValue] of Object.entries(variables)) {
                if (varName.endsWith('Id')) continue;

                let matches = JSON.stringify(varValue) === JSON.stringify(afterValue);
                if (!matches && typeof varValue === 'string') {
                    try {
                        matches = JSON.stringify(JSON.parse(varValue)) === JSON.stringify(afterValue);
                    } catch { /* ignore */ }
                }

                if (matches) {
                    changes[varName] = varValue;
                    break;
                }
            }
        }
    }

    return Object.keys(changes).length > 0 ? changes : null;
};

// Fetch pre-execution data for deletes and updates
const fetchPreExecutionData = async (mutationFields, variables, db, schema) => {
    const preData = {};

    for (const name of mutationFields) {
        if (!isUpdate(name) && !isDelete(name)) continue;

        const { entityType } = getMutationInfo(name, schema);

        try {
            let entityIds = [];

            if (isBulkOp(name)) {
                // Extract IDs from bulk variables
                if (variables.updates) {
                    const updates = parseJsonVar(variables.updates);
                    if (Array.isArray(updates)) {
                        entityIds = updates.map(u => {
                            const obj = typeof u === 'string' ? JSON.parse(u) : u;
                            return obj.id;
                        }).filter(Boolean);
                    }
                }
                if (variables.ids) {
                    const ids = parseJsonVar(variables.ids);
                    entityIds.push(...(Array.isArray(ids) ? ids : [ids]));
                }
            } else {
                // Single entity
                let entityId = variables.id || findEntityIdInVars(variables);

                // Special handling for text updates that use field-specific ID variables
                if (!entityId && entityType === 'texts') {
                    const fieldName = TEXT_FIELD_ID_VARIABLES.find(fieldName => variables[fieldName]);
                    if (fieldName) entityId = variables[fieldName];
                }

                // For junction deletes, handle both direct ID and where clause deletes
                if (isDelete(name) && JUNCTION_TABLE_TYPES.includes(entityType)) {
                    if (!entityId) {
                        // No direct ID provided, try to find junction record by component IDs
                        entityId = await findJunctionId(entityType, variables, db);
                    } else {
                        // Check if the provided ID is actually a junction record ID
                        const junctionRecord = await db.query[entityType].findFirst({
                            where: (e, { eq }) => eq(e.id, entityId)
                        });

                        if (!junctionRecord) {
                            // The ID doesn't exist as a junction record, try to find by component IDs
                            entityId = await findJunctionId(entityType, variables, db);
                        }
                    }
                }

                if (entityId) entityIds = [entityId];
            }

            if (entityIds.length === 0) continue;

            const foundEntities = [];
            for (const id of entityIds) {
                let entity = null;

                // For junction deletes, get with relationships
                if (isDelete(name) && JUNCTION_TABLE_TYPES.includes(entityType)) {
                    entity = await JUNCTION_RELATION_EXTRACTORS[entityType]?.(db, id);
                } else {
                    entity = await findEntityInTables(id, db);
                }

                if (entity) foundEntities.push(entity);
            }

            if (foundEntities.length > 0) {
                preData[name] = foundEntities.length === 1 ? foundEntities[0] : foundEntities;
            }
        } catch (error) {
            console.error(`Error fetching pre-execution data for ${name}:`, error);
        }
    }

    return preData;
};

// Create action record
const createActionRecord = async (name, actionType, entityType, entityId, variables, context, db, preData = null) => {
    const clientId = context?.clientId || await getClientId();
    const projectId = await extractProjectId(variables, entityType, entityId, db, preData);
    const metadata = await generateActionMetadata(actionType, entityType, entityId, db, preData);

    return {
        user_id: context?.userId || null,
        project_id: projectId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        changes: JSON.stringify({ mutation_name: name, variables, timestamp: Date.now() }),
        client_id: clientId,
        yjs_update: context?.yjsUpdate || null,
        parent_action_id: context?.parentActionId || null,
        metadata
    };
};

// Process mutations and create action logs
const processMutationActions = async (mutationFields, result, variables, context, db, preData, schema) => {
    const actionRows = [];

    for (const name of mutationFields) {
        const fieldResult = result.data[name];

        if (!fieldResult || (Array.isArray(fieldResult) && fieldResult.length === 0)) {
            continue;
        }

        const { actionType, entityType } = getMutationInfo(name, schema);

        if (Array.isArray(fieldResult)) {
            // Bulk operation
            for (let i = 0; i < fieldResult.length; i++) {
                const entity = fieldResult[i];
                if (!entity?.id) continue;

                let entityVars = variables;
                let preEntityData = null;

                if (actionType === 'UPDATE' && preData[name]) {
                    const preEntity = Array.isArray(preData[name])
                        ? preData[name].find(e => e.id === entity.id)
                        : preData[name];

                    if (preEntity) {
                        const changed = getChangedFields(variables, preEntity, entity);
                        // For text updates, always create action records since GraphQL result only contains ID
                        if (!changed && entityType !== 'texts') continue;
                        entityVars = changed || variables; // Use original variables if no changes detected
                        preEntityData = preEntity;
                    } else {
                        // Pre-data exists but specific entity not found - still create action record for text updates
                        if (entityType === 'texts') {
                            entityVars = variables;
                            preEntityData = null;
                        } else {
                            continue; // Skip for non-text entities if entity not found in pre-data
                        }
                    }
                } else if (actionType === 'DELETE') {
                    entityVars = { id: entity.id };
                    // For junction deletes, try to get the pre-execution data
                    if (JUNCTION_TABLE_TYPES.includes(entityType)) {
                        preEntityData = Array.isArray(preData[name])
                            ? preData[name].find(e => e.id === entity.id)
                            : preData[name];

                        // If no pre-data was captured and the result contains junction info, use that
                        if (!preEntityData && entity.object_id) {
                            preEntityData = entity;
                        }
                    }
                } else if (actionType === 'CREATE' && variables.values) {
                    const values = parseJsonVar(variables.values);
                    if (Array.isArray(values) && values[i]) {
                        entityVars = values[i];
                    }
                } else if (actionType === 'UPDATE') {
                    // Fallback for UPDATE operations without pre-data or other conditions
                    entityVars = variables;
                    preEntityData = null;
                }

                const bulkActionRecord = await createActionRecord(name, actionType, entityType, entity.id, entityVars, context, db, preEntityData);
                actionRows.push(bulkActionRecord);
            }
        } else {
            // Single entity
            const entityId = fieldResult?.id;
            let preEntityData = null;

            if (actionType === 'UPDATE' && entityId && preData[name]) {
                const changed = getChangedFields(variables, preData[name], fieldResult);
                if (!changed) {
                    continue;
                }
                preEntityData = preData[name];
                const updateActionRecord = await createActionRecord(name, actionType, entityType, entityId, changed, context, db, preEntityData);
                actionRows.push(updateActionRecord);
            } else {
                // For DELETE operations on junction tables, use pre-data or result data
                if (actionType === 'DELETE' && JUNCTION_TABLE_TYPES.includes(entityType)) {
                    preEntityData = preData[name];

                    // If no pre-data was captured but the result contains junction info, use that
                    if (!preEntityData && fieldResult?.object_id) {
                        preEntityData = fieldResult;
                    }
                } else {
                    preEntityData = preData[name] || null;
                }

                // For UPDATE operations without pre-data, still create action record
                // This handles cases like updateTexts where entity ID is in non-standard variable names
                const singleActionRecord = await createActionRecord(name, actionType, entityType, entityId, variables, context, db, preEntityData);
                actionRows.push(singleActionRecord);
            }
        }
    }

    // Handle workflow-based parent actions
    if (actionRows.length > 0 && context?.workflowId) {
        let parentActionId = activeWorkflows.get(context.workflowId);

        // Create parent action on first mutation step of workflow  
        if (!parentActionId) {
            const primaryEntity = getPrimaryEntityFromActions(actionRows);

            if (primaryEntity && primaryEntity.entityType && primaryEntity.entityId) {
                parentActionId = crypto.randomUUID();
                const clientId = context?.clientId || await getClientId();
                const projectId = await extractProjectId({}, primaryEntity.entityType, primaryEntity.entityId, db);

                const parentAction = {
                    id: parentActionId,
                    user_id: context?.userId || null,
                    project_id: projectId,
                    action_type: 'UPDATE', // Will be determined after all steps
                    entity_type: primaryEntity.entityType,
                    entity_id: primaryEntity.entityId,
                    changes: null,
                    client_id: clientId,
                    yjs_update: null,
                    parent_action_id: null,
                    metadata: JSON.stringify({
                        workflow_id: context.workflowId
                    })
                };

                // Store workflow and insert parent action
                activeWorkflows.set(context.workflowId, parentActionId);
                await db.insert(actions).values([parentAction]).execute();
            }
        }

        // Link child actions to parent
        if (parentActionId) {
            actionRows.forEach(row => row.parent_action_id = parentActionId);
        }

        // Clean up workflow on last mutation step (1-based indexing)
        if (context.stepIndex >= context.totalSteps) {
            activeWorkflows.delete(context.workflowId);
        }
    } else {
        if (actionRows.length > 0 && mutationFields.length > 1) {
            // Fallback: Create parent action for single GraphQL operations with multiple fields
            const primaryEntity = getPrimaryEntityFromActions(actionRows);

            if (primaryEntity) {
                const parentActionId = crypto.randomUUID();
                const parentActionType = getParentActionType(actionRows, primaryEntity.entityId);
                const clientId = context?.clientId || await getClientId();
                const projectId = await extractProjectId({}, primaryEntity.entityType, primaryEntity.entityId, db);

                const parentAction = {
                    id: parentActionId,
                    user_id: context?.userId || null,
                    project_id: projectId,
                    action_type: parentActionType,
                    entity_type: primaryEntity.entityType,
                    entity_id: primaryEntity.entityId,
                    changes: null,
                    client_id: clientId,
                    yjs_update: null,
                    parent_action_id: null,
                    metadata: JSON.stringify({
                        mutations: mutationFields,
                        child_count: actionRows.length
                    })
                };

                // Link child actions to parent and add parent to rows
                actionRows.forEach(row => row.parent_action_id = parentActionId);
                actionRows.unshift(parentAction);
            }
        }
    }

    // Save to database
    if (actionRows.length > 0) {
        try {
            await db.insert(actions).values(actionRows).execute();
        } catch (error) {
            console.error('Error saving actions:', error);
        }
    }
};

// Track active workflows to create parent actions
const activeWorkflows = new Map();



// Main GraphQL handler
export const handleGraphQL = async (event, { query, variables, context }, { schema, resolvers, db }) => {
    try {
        const parsed = parse(query);
        const op = parsed.definitions.find(d => d.kind === 'OperationDefinition');
        const isMutation = op?.operation === 'mutation';



        // Get pre-execution data for mutations
        let preData = {};
        if (isMutation) {
            const mutationFields = extractMutationFields(op);
            preData = await fetchPreExecutionData(mutationFields, variables, db, schema);
        }

        // Execute GraphQL
        const result = await graphql({
            schema,
            source: query,
            rootValue: resolvers,
            variableValues: variables,
            contextValue: { db }
        });

        // Process actions for mutations
        if (!result.errors && isMutation && result.data) {
            const mutationFields = extractMutationFields(op);
            await processMutationActions(mutationFields, result, variables, context, db, preData, schema);
        }

        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            return { success: false, errors: result.errors };
        }

        return { success: true, data: result.data };
    } catch (error) {
        console.error('Error executing GraphQL:', error);
        return { success: false, error: error.message };
    }
}; 