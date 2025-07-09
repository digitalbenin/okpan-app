import { graphql, parse } from 'graphql';
import { actions } from '../../db/schema.js';
import { getClientId } from '../../db/init.js';

// Utility functions for bulk operations
const isBulkOperation = (mutationName) => mutationName.toLowerCase().includes('bulk');

const isUpdateOperation = (mutationName) => mutationName.toLowerCase().includes('update');

const isDeleteOperation = (mutationName) => mutationName.toLowerCase().includes('delete');

const isCreateOperation = (mutationName) => mutationName.toLowerCase().includes('create') || mutationName.toLowerCase().startsWith('insertinto');

const parseBulkVariable = (variable) => {
    if (typeof variable === 'string') {
        try {
            return JSON.parse(variable);
        } catch (error) {
            console.error('Error parsing bulk variable:', error);
            return variable;
        }
    }
    if (Array.isArray(variable) && variable.length === 1 && typeof variable[0] === 'string') {
        try {
            return JSON.parse(variable[0]);
        } catch (error) {
            console.error('Error parsing bulk variable array:', error);
            return variable;
        }
    }
    return variable;
};

const extractEntityIdsFromBulkVariables = (variables) => {
    const entityIds = [];

    if (variables.updates) {
        const updates = parseBulkVariable(variables.updates);
        if (Array.isArray(updates)) {
            entityIds.push(...updates.map(update => {
                const updateObj = typeof update === 'string' ? JSON.parse(update) : update;
                return updateObj.id;
            }).filter(id => id));
        }
    }

    if (variables.ids) {
        const ids = parseBulkVariable(variables.ids);
        entityIds.push(...(Array.isArray(ids) ? ids : [ids]));
    }

    // For bulk creates, we don't have entity IDs in variables (they don't exist yet)
    // Entity IDs will come from the result

    return entityIds;
};



// Extract mutation field names from GraphQL operation
const extractMutationFields = (op) =>
    op?.selectionSet?.selections?.filter(s => s.kind === 'Field')?.map(s => s.name.value) ?? [];

// Get mutation metadata from GraphQL schema
const getMutationInfo = (fieldName, schema) => {
    const mutationType = schema.getType('Mutation');
    const field = mutationType.getFields()[fieldName];

    // Get return type
    let returnType = field.type;
    while (returnType.ofType) returnType = returnType.ofType;

    // Get entity type from drizzle mappings
    const entityType = schema._drizzleTypes?.[returnType.name] || 'unknown';

    // Determine action type from field name using case-insensitive detection
    const lowerFieldName = fieldName.toLowerCase();
    let actionType = 'CREATE';
    if (lowerFieldName.includes('delete') || lowerFieldName.includes('remove')) {
        actionType = 'DELETE';
    } else if (lowerFieldName.includes('update')) {
        actionType = 'UPDATE';
    } else if (lowerFieldName.includes('insert') || lowerFieldName.includes('create')) {
        actionType = 'CREATE';
    }

    return { actionType, entityType };
};

// Extract entity ID from mutation result
const extractEntityId = (fieldResult) =>
    Array.isArray(fieldResult) ? fieldResult[0]?.id ?? null : fieldResult?.id ?? null;

// Compare before/after entities and extract changed fields
const getChangedFields = (variables, currentEntity, fieldResult) => {
    if (!currentEntity) return variables;

    const afterEntity = Array.isArray(fieldResult) ? fieldResult[0] : fieldResult;
    if (!afterEntity) return variables;

    const changes = {};

    // Compare fields that exist in both entities
    for (const fieldName in afterEntity) {
        if (fieldName === 'id' || fieldName === 'created_at' || fieldName === 'updated_at') continue;

        const beforeValue = currentEntity[fieldName];
        const afterValue = afterEntity[fieldName];

        // Normalize both values for comparison (handle JSON strings vs parsed objects)
        let normalizedBefore = beforeValue;

        // If before value is a JSON string, parse it for comparison
        if (typeof beforeValue === 'string' && (beforeValue.startsWith('[') || beforeValue.startsWith('{'))) {
            try {
                normalizedBefore = JSON.parse(beforeValue);
            } catch (e) {
                // Not JSON, keep as string
            }
        }

        const beforeStr = JSON.stringify(normalizedBefore);
        const afterStr = JSON.stringify(afterValue);

        if (beforeStr !== afterStr) {
            // Find corresponding variable by matching the NEW value (afterValue)
            for (const [varName, varValue] of Object.entries(variables)) {
                if (varName.endsWith('Id')) continue;

                let variableMatches = false;

                // Direct comparison
                if (JSON.stringify(varValue) === afterStr) {
                    variableMatches = true;
                }
                // Handle JSON string variables
                else if (typeof varValue === 'string') {
                    try {
                        const parsedVarValue = JSON.parse(varValue);
                        if (JSON.stringify(parsedVarValue) === afterStr) {
                            variableMatches = true;
                        }
                    } catch (e) {
                        // Not JSON, continue
                    }
                }

                if (variableMatches) {
                    changes[varName] = varValue;
                    break;
                }
            }
        }
    }

    return Object.keys(changes).length > 0 ? changes : null;
};

// Create action record for database
const createActionRecord = async (name, actionType, entityType, entityId, changedFields, context) => {
    const clientId = context?.clientId || await getClientId();

    return {
        user_id: context?.userId || null,
        project_id: context?.projectId || null,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        changes: JSON.stringify({
            mutation_name: name,
            variables: changedFields,
            timestamp: Date.now()
        }),
        client_id: clientId,
        yjs_update: context?.yjsUpdate || null,
        parent_action_id: context?.parentActionId || null
    };
};

// Fetch pre-execution entities for UPDATE operations
const fetchPreExecutionEntities = async (mutationFields, variables, db) => {
    const preExecutionEntities = {};

    for (const name of mutationFields) {
        if (!isUpdateOperation(name)) continue;

        let entityIds = [];

        if (isBulkOperation(name)) {
            entityIds = extractEntityIdsFromBulkVariables(variables);
        } else {
            // Single entity operation - find entity ID in variables
            const entityId = Object.values(variables).find(v =>
                typeof v === 'string' && v.match(/^[a-f0-9-]{36}$/i)
            );
            if (entityId) {
                entityIds = [entityId];
            }
        }

        if (entityIds.length === 0) continue;

        // Search across all tables to find the entities
        const tableNames = Object.keys(db.query);
        const foundEntities = [];

        for (const tableName of tableNames) {
            try {
                for (const entityId of entityIds) {
                    const found = await db.query[tableName].findFirst({
                        where: (entity, { eq }) => eq(entity.id, entityId)
                    });
                    if (found) {
                        foundEntities.push(found);
                    }
                }
                // If we found entities in this table, no need to check other tables
                if (foundEntities.length > 0) {
                    preExecutionEntities[name] = foundEntities.length === 1 ? foundEntities[0] : foundEntities;
                    break;
                }
            } catch (error) {
                // Continue to next table
            }
        }
    }

    return preExecutionEntities;
};



// Process mutation results and create action logs
const processMutationActions = async (mutationFields, result, variables, context, db, preExecutionEntities, schema) => {
    const actionRows = [];

    for (const name of mutationFields) {
        const fieldResult = result.data[name];
        if (!fieldResult || (Array.isArray(fieldResult) && fieldResult.length === 0)) continue;

        const { actionType, entityType } = getMutationInfo(name, schema);

        // Handle bulk operations (mutations that return arrays)
        if (Array.isArray(fieldResult)) {
            // This is a bulk operation - create one action log per affected entity
            for (let index = 0; index < fieldResult.length; index++) {
                const entity = fieldResult[index];
                if (!entity?.id) continue;

                let entityVariables = variables;

                // For bulk updates with pre-execution data, use the same logic as single operations
                if (actionType === 'UPDATE' && preExecutionEntities[name]) {
                    const preExecutionEntity = Array.isArray(preExecutionEntities[name])
                        ? preExecutionEntities[name].find(e => e.id === entity.id)
                        : preExecutionEntities[name];

                    if (preExecutionEntity) {
                        const changedFields = getChangedFields(variables, preExecutionEntity, entity);
                        if (!changedFields) continue; // No changes detected
                        entityVariables = changedFields;
                    }
                }
                // For bulk deletes, create individual actions like single deletes
                else if (actionType === 'DELETE') {
                    entityVariables = { id: entity.id };
                }
                // For bulk creates, create individual actions like single creates
                else if (actionType === 'CREATE' && variables.values) {
                    const values = parseBulkVariable(variables.values);
                    if (Array.isArray(values) && values[index]) {
                        // Use the individual entity data directly
                        entityVariables = values[index];
                    }
                }

                actionRows.push(await createActionRecord(name, actionType, entityType, entity.id, entityVariables, context));
            }
        } else {
            // Single entity operation - use existing logic
            const entityId = fieldResult?.id ?? null;

            if (actionType === 'UPDATE' && entityId && preExecutionEntities[name]) {
                const changedFields = getChangedFields(variables, preExecutionEntities[name], fieldResult);
                if (!changedFields) continue; // No changes detected

                actionRows.push(await createActionRecord(name, actionType, entityType, entityId, changedFields, context));
            } else {
                // For CREATE/DELETE or UPDATE without pre-execution data
                actionRows.push(await createActionRecord(name, actionType, entityType, entityId, variables, context));
            }
        }
    }

    // Save action logs
    if (actionRows.length > 0) {
        try {
            await db.insert(actions).values(actionRows).execute();
        } catch (error) {
            console.error('Error saving actions:', error);
        }
    }
};

// Main GraphQL handler
export const handleGraphQL = async (event, { query, variables, context }, { schema, resolvers, db }) => {
    try {
        const parsed = parse(query);
        const op = parsed.definitions.find(d => d.kind === 'OperationDefinition');
        const isMutation = op?.operation === 'mutation';

        // Fetch pre-execution entities for mutations
        let preExecutionEntities = {};
        if (isMutation) {
            const mutationFields = extractMutationFields(op);
            preExecutionEntities = await fetchPreExecutionEntities(mutationFields, variables, db);
        }

        // Execute GraphQL query/mutation
        const result = await graphql({
            schema,
            source: query,
            rootValue: resolvers,
            variableValues: variables,
            contextValue: { db }
        });

        // Process mutation actions for logging
        if (!result.errors && isMutation && result.data) {
            const mutationFields = extractMutationFields(op);
            await processMutationActions(mutationFields, result, variables, context, db, preExecutionEntities, schema);
        }

        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            return { success: false, errors: result.errors };
        }

        return { success: true, data: result.data };
    } catch (error) {
        console.error('Error executing GraphQL query:', error);
        return { success: false, error: error.message };
    }
}; 