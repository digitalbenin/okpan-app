import { graphql, parse } from 'graphql';
import { actions } from '../../db/schema.js';

/**
 * Extracts mutation fields from GraphQL operation
 */
const extractMutationFields = (op) => {
    if (!op?.selectionSet?.selections) return [];

    return op.selectionSet.selections
        .filter(selection => selection.kind === 'Field')
        .map(selection => selection.name.value);
};

/**
 * Parses mutation name to extract action type and entity type
 */
const parseMutationName = (name) => {
    // Handle junction table operations like deleteFromObjects_assets, addToObjects_assets
    const junctionMatch = /^(add|remove|delete)(From|To)([A-Z][a-zA-Z]*)_([a-zA-Z]+)/i.exec(name);
    if (junctionMatch) {
        const [, action, preposition, table1, table2] = junctionMatch;
        return {
            actionType: action.toUpperCase() === 'REMOVE' ? 'DELETE' : action.toUpperCase(),
            entityType: `${table1.toLowerCase()}_${table2.toLowerCase()}`
        };
    }

    // Handle regular operations like createObjects, updateInstitutions
    const regularMatch = /^(create|update|delete|add|remove)([A-Z][a-zA-Z]*)/i.exec(name);
    if (regularMatch) {
        return {
            actionType: regularMatch[1].toUpperCase(),
            entityType: regularMatch[2].replace(/s$/, '').toLowerCase()
        };
    }

    return null;
};

/**
 * Fetches current values for UPDATE mutations before execution
 */
const fetchCurrentValues = async (mutationFields, variables, db) => {
    const currentValues = {};

    for (const name of mutationFields) {
        const parsed = parseMutationName(name);
        if (!parsed || parsed.actionType !== 'UPDATE') continue;

        try {
            if (name === 'updateTexts') {
                const textId = Object.values(variables).find(v =>
                    typeof v === 'string' && v.match(/^[a-f0-9-]{36}$/i)
                );
                if (textId) {
                    const currentText = await db.query.texts.findFirst({
                        where: (texts, { eq }) => eq(texts.id, textId)
                    });
                    if (currentText) {
                        currentValues[name] = currentText.content;
                    }
                }
            } else if (name === 'updateInstitutions') {
                const institutionId = variables.institutionId;
                if (institutionId) {
                    const currentInstitution = await db.query.institutions.findFirst({
                        where: (institutions, { eq }) => eq(institutions.id, institutionId)
                    });
                    if (currentInstitution) {
                        currentValues[name] = {
                            status: currentInstitution.status,
                            links: currentInstitution.links
                        };
                    }
                }
            }
        } catch (error) {
            console.error(`Error fetching current values for ${name}:`, error);
        }
    }

    return currentValues;
};

/**
 * Extracts entity ID from mutation result
 */
const extractEntityId = (fieldResult) => {
    if (!fieldResult) return null;

    if (Array.isArray(fieldResult)) {
        return fieldResult[0]?.id || null;
    }

    if (typeof fieldResult === 'object' && fieldResult.id) {
        return fieldResult.id;
    }

    return null;
};

/**
 * Checks if UPDATE mutation actually changed data
 */
const hasActualChanges = (name, variables, currentValue) => {
    if (name === 'updateTexts' && currentValue !== undefined) {
        const newContent = Object.entries(variables)
            .find(([key, value]) => !key.endsWith('Id') && typeof value === 'string')?.[1];
        return newContent && newContent !== currentValue;
    }

    if (name === 'updateInstitutions' && currentValue) {
        if (variables.status && variables.status !== currentValue.status) {
            return true;
        }
        if (variables.links && JSON.stringify(variables.links) !== JSON.stringify(currentValue.links)) {
            return true;
        }
        return false;
    }

    // For other cases, assume changes occurred
    return true;
};

/**
 * Creates action record for CRDT synchronization
 */
const createActionRecord = (name, actionType, entityType, entityId, variables, fieldResult, context) => {
    const changeRecord = {
        mutation_name: name,
        variables: variables,
        timestamp: Date.now()
    };

    return {
        user_id: context?.userId || null,
        project_id: context?.projectId || null,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        changes: JSON.stringify(changeRecord),
        client_id: context?.clientId || null,
        yjs_update: context?.yjsUpdate || null,
        parent_action_id: context?.parentActionId || null
    };
};

/**
 * Processes mutations and creates action logs
 */
const processMutationActions = async (op, result, variables, context, currentValues, db) => {
    const mutationFields = extractMutationFields(op);
    const actionRows = [];

    for (const name of mutationFields) {
        const parsed = parseMutationName(name);
        if (!parsed) continue;

        const { actionType, entityType } = parsed;
        const fieldResult = result.data[name];
        const entityId = extractEntityId(fieldResult);

        // Skip if no rows were affected
        if (!fieldResult || (Array.isArray(fieldResult) && fieldResult.length === 0)) {
            continue;
        }

        // For UPDATE operations, check for actual changes
        if (actionType === 'UPDATE') {
            const currentValue = currentValues[name];
            if (!hasActualChanges(name, variables, currentValue)) {
                continue;
            }
        }

        const actionRecord = createActionRecord(name, actionType, entityType, entityId, variables, fieldResult, context);
        actionRows.push(actionRecord);
    }

    // Save action records
    if (actionRows.length > 0) {
        try {
            await db.insert(actions).values(actionRows).execute();
        } catch (error) {
            console.error('Error saving actions:', error);
        }
    }
};

/**
 * Handler for executing GraphQL queries
 */
export const handleGraphQL = async (event, { query, variables, context }, { schema, resolvers, db }) => {
    try {
        const parsed = parse(query);
        const op = parsed.definitions.find(d => d.kind === 'OperationDefinition');

        // For mutations, fetch current values before execution
        let currentValues = {};
        if (op?.operation === 'mutation') {
            const mutationFields = extractMutationFields(op);
            currentValues = await fetchCurrentValues(mutationFields, variables, db);
        }

        // Execute GraphQL operation
        const result = await graphql({
            schema,
            source: query,
            rootValue: resolvers,
            variableValues: variables,
            contextValue: { db }
        });

        // Process mutation actions for logging
        if (!result.errors && op?.operation === 'mutation' && result.data) {
            await processMutationActions(op, result, variables, context, currentValues, db);
        }

        // Return result
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