import { graphql, parse } from 'graphql';
import { actions } from '../../db/schema.js';

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

    // Determine action type from field name
    let actionType = 'CREATE';
    if (fieldName.includes('delete') || fieldName.includes('remove')) actionType = 'DELETE';
    else if (fieldName.includes('update')) actionType = 'UPDATE';
    else if (fieldName.includes('insert') || fieldName.includes('create')) actionType = 'CREATE';

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
const createActionRecord = (name, actionType, entityType, entityId, changedFields, context) => ({
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
    client_id: context?.clientId || null,
    yjs_update: context?.yjsUpdate || null,
    parent_action_id: context?.parentActionId || null
});

// Fetch pre-execution entities for UPDATE operations
const fetchPreExecutionEntities = async (mutationFields, variables, db) => {
    const preExecutionEntities = {};

    for (const name of mutationFields) {
        if (!name.startsWith('update')) continue;

        // Find entity ID in variables
        const entityId = Object.values(variables).find(v =>
            typeof v === 'string' && v.match(/^[a-f0-9-]{36}$/i)
        );

        if (!entityId) continue;

        // Search across all tables to find the entity
        const tableNames = Object.keys(db.query);
        for (const tableName of tableNames) {
            try {
                const found = await db.query[tableName].findFirst({
                    where: (entity, { eq }) => eq(entity.id, entityId)
                });
                if (found) {
                    preExecutionEntities[name] = found;
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
        const entityId = extractEntityId(fieldResult);

        if (actionType === 'UPDATE' && entityId && preExecutionEntities[name]) {
            const changedFields = getChangedFields(variables, preExecutionEntities[name], fieldResult);
            if (!changedFields) continue; // No changes detected

            actionRows.push(createActionRecord(name, actionType, entityType, entityId, changedFields, context));
        } else {
            // For CREATE/DELETE or UPDATE without pre-execution data
            actionRows.push(createActionRecord(name, actionType, entityType, entityId, variables, context));
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