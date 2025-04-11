import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { addToast } from "$lib/components/base/BaseToast.svelte";
import { API_SECTIONS, performQuery } from "$lib/utils/queries.js";

const { error: logError } = getLogStore();

/**
 * Enhanced version of performQuery that checks for GraphQL errors
 * @param {Object} query - Query definition
 * @param {Object} params - Parameters for the query
 * @returns {Promise<Object>} Query result
 * @throws {Error} If the query fails or contains GraphQL errors
 */
export async function executeGraphQLOperation(query, params) {
    // Perform the query using the existing function
    const result = await performQuery(query, params);

    // Check if there are GraphQL errors in the result
    // GraphQL can return data with errors, so we need to check for both
    if (result && result.errors) {
        // Get the first error message or a default message
        const errorMessage = result.errors[0]?.message || 'GraphQL operation failed';
        console.error('GraphQL operation errors:', result.errors);

        // Create a custom error with the GraphQL error details
        const error = new Error(errorMessage);
        error.graphqlErrors = result.errors;
        error.graphqlResult = result;

        // Throw the error to be caught by the calling function
        throw error;
    }

    return result;
}

/**
 * Execute a chain of mutations in sequence
 * @param {Array} mutations - Array of mutation definitions
 * @param {Object} params - Parameters for the mutations
 * @returns {Promise<Object>} Final operation result
 */
async function executeMultiStepMutation(mutations, params) {
    if (!mutations || !Array.isArray(mutations) || mutations.length === 0) {
        throw new Error("Invalid mutation chain");
    }

    // Store intermediate results for using in subsequent steps
    const results = {};
    const finalResults = {};

    for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        // Skip this step if the skipIf condition is met
        if (mutation.skipIf) {
            const { variableName, isUndefined } = mutation.skipIf;

            if ((isUndefined && params[variableName] === undefined) ||
                (!isUndefined && params[variableName] !== undefined)) {
                continue;
            }
        }

        // Prepare variables for this step
        const stepVariables = {};

        // Add variables directly specified in useVariables
        if (mutation.useVariables) {
            mutation.useVariables.forEach(varName => {
                if (params[varName] !== undefined) {
                    stepVariables[varName] = params[varName];
                }
            });
        }

        // Map variables from previous step results
        if (mutation.mapVariables) {
            for (const [targetVar, mapping] of Object.entries(mutation.mapVariables)) {
                const { from, path } = mapping;
                if (!results[from]) {
                    console.warn(`Missing dependency: ${from} for variable ${targetVar}`);
                    continue;
                }

                // Get value from the specified path
                let value = results[from];
                const pathParts = path.split('.');

                for (const part of pathParts) {
                    if (value === undefined || value === null) break;
                    value = value[part];
                }

                if (value !== undefined) {
                    stepVariables[targetVar] = value;
                }
            }
        }

        // Execute this step
        try {
            const result = await executeGraphQLOperation({ name: mutation.name, query: mutation.query }, stepVariables);
            results[mutation.name] = result;
            Object.assign(finalResults, result);
        } catch (error) {
            console.error(`Error in mutation step ${mutation.name}:`, error);
            throw error;
        }
    }

    return finalResults;
}

/**
 * Perform a partial update (PATCH-style) on an entity
 * @param {Object} query - Original update query definition
 * @param {Object} params - Parameters including only fields to update
 * @returns {Promise<Object>} Operation result
 */
export async function performPartialUpdate(query, params) {
    if (!query) {
        throw new Error("Invalid query definition");
    }

    // If the query uses multi-step mutations, use the executeMultiStepMutation function
    if (query.mutations && Array.isArray(query.mutations)) {
        return executeMultiStepMutation(query.mutations, params);
    }

    // Fall back to original implementation for single-query updates
    if (!query.query) {
        throw new Error("Query has no query string or mutations");
    }

    // Extract operation blocks from the original query
    const operationBlocks = [];
    const originalQuery = query.query;
    const providedParams = Object.keys(params);

    // Match each update operation in the query
    const updateRegex = /(\w+):\s*update(\w+)\(\s*set:\s*\{\s*([^}]+)\}\s*where:/g;
    let match;

    while ((match = updateRegex.exec(originalQuery)) !== null) {
        const operationName = match[1];
        const entityName = match[2];
        const setClause = match[3];

        // Check if this operation updates fields we're providing
        const fieldsInOperation = setClause.split(',')
            .map(fieldPair => fieldPair.trim().split(':')[0].trim())
            .filter(field => providedParams.includes(field));

        if (fieldsInOperation.length > 0) {
            // Find the complete operation block
            const opStart = match.index;
            let opEnd = opStart;
            let braceCount = 0;
            let startFound = false;

            for (let i = opStart; i < originalQuery.length; i++) {
                if (originalQuery[i] === '{') {
                    braceCount++;
                    startFound = true;
                } else if (originalQuery[i] === '}') {
                    braceCount--;
                    if (startFound && braceCount === 0) {
                        opEnd = i + 1;
                        break;
                    }
                }
            }

            operationBlocks.push({
                name: operationName,
                entity: entityName,
                fields: fieldsInOperation,
                operation: originalQuery.substring(opStart, opEnd)
            });
        }
    }

    // If no matching operations, return null
    if (operationBlocks.length === 0) {
        return null;
    }

    // Extract the required parameters (e.g., ID) from the original query
    const mutationMatch = originalQuery.match(/mutation\s+\w+\(([^)]+)\)/);
    if (!mutationMatch) {
        throw new Error("Unable to parse mutation signature");
    }

    const requiredParams = mutationMatch[1].split(',')
        .filter(param => param.includes('!'))
        .map(param => {
            const paramMatch = param.match(/\$(\w+):/);
            return paramMatch ? paramMatch[1] : null;
        })
        .filter(Boolean);

    // Build a new query with only the needed operations
    const newQueryName = `Partial${query.name.replace(/\s/g, '')}`;
    const variableDeclarations = [
        ...requiredParams.map(param => {
            const typeMatch = originalQuery.match(new RegExp(`\\$${param}:\\s*(\\w+)!`));
            return `$${param}: ${typeMatch ? typeMatch[1] : 'String'}!`;
        }),
        ...operationBlocks.flatMap(op =>
            op.fields.map(field => {
                const typeMatch = originalQuery.match(new RegExp(`\\$${field}:\\s*(\\w+)`));
                return `$${field}: ${typeMatch ? typeMatch[1] : 'String'}`;
            })
        )
    ];

    const newQuery = {
        name: query.name,
        query: `mutation ${newQueryName}(${variableDeclarations.join(', ')}) {
  ${operationBlocks.map(op => op.operation).join('\n  ')}
}`
    };

    // Execute the modified query with only the provided parameters
    return executeGraphQLOperation(newQuery, params);
}

/**
 * Perform bulk updates on multiple items
 * @param {Object} query - Original update query definition
 * @param {Array} items - Array of items to update
 * @returns {Promise<Object>} Bulk operation results
 */
export async function performBulkUpdate(query, items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return null;
    }

    // Group items by what fields they're updating
    const groups = [];

    items.forEach(item => {
        // Create a pattern based on provided fields (excluding ID)
        const idField = Object.keys(item).find(key => key.toLowerCase().includes('id'));
        const fieldPattern = Object.keys(item)
            .filter(key => key !== idField)
            .sort()
            .join('|');

        let group = groups.find(g => g.pattern === fieldPattern);
        if (!group) {
            group = { pattern: fieldPattern, items: [] };
            groups.push(group);
        }

        group.items.push(item);
    });

    // Process each group with a tailored partial update
    const results = [];

    for (const group of groups) {
        // For each group, create an optimized partial update
        const itemResults = await Promise.all(
            group.items.map(item => performPartialUpdate(query, item))
        );

        results.push({
            pattern: group.pattern,
            results: itemResults
        });
    }

    return { bulkResults: results };
}

/**
 * Perform a delete operation on an entity
 * @param {Object} query - Delete query definition
 * @param {Object} params - Parameters for the delete operation (e.g. ID)
 * @returns {Promise<Object>} Operation result
 */
export async function performDelete(query, params) {
    if (!query) {
        throw new Error("Invalid query definition");
    }

    // Multi-step delete operation (for complex deletions that require cleanup)
    if (query.mutations && Array.isArray(query.mutations)) {
        return executeMultiStepMutation(query.mutations, params);
    }

    // Simple delete
    if (!query.query) {
        throw new Error("Query has no query string or mutations");
    }

    // Use enhanced query execution that properly checks for GraphQL errors
    return executeGraphQLOperation(query, params);
}

/**
 * Perform bulk delete operations on multiple items
 * @param {Object} query - Delete query definition
 * @param {Array} ids - Array of IDs to delete
 * @param {string} idField - Name of the ID field to use (default: 'id')
 * @returns {Promise<Object>} Bulk operation results
 */
export async function performBulkDelete(query, ids, idField = 'id') {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return null;
    }

    // Execute delete operations in parallel
    const results = await Promise.all(
        ids.map(id => {
            const params = { [idField]: id };
            return performDelete(query, params);
        })
    );

    return {
        count: results.length,
        results
    };
}

/**
 * Performs an operation based on the API_SECTIONS configuration
 * @param {string} section - API section name
 * @param {string} operation - Operation name within the section
 * @param {Object} params - Parameters for the operation
 * @returns {Promise<Object>} Operation result
 */
export function executeQuery(section, operation, params = {}) {
    if (!section || !operation) {
        throw new Error('Missing section or operation');
    }

    if (!API_SECTIONS[section]) {
        throw new Error(`Section ${section} not found`);
    }

    const queryDef = API_SECTIONS[section].operations[operation];
    if (!queryDef) {
        throw new Error(`Operation ${operation} not found in section ${section}`);
    }

    return executeGraphQLOperation(queryDef, params);
}

/**
 * Execute a complex multi-step delete operation based on the configured mutations
 * @param {string} section - API section name
 * @param {string} operation - Delete operation name
 * @param {Object} params - Delete parameters
 * @returns {Promise<Object>} Delete operation result
 */
export async function deleteEntity(section, params = {}) {
    if (!section) {
        throw new Error('Missing section for delete operation');
    }

    if (!API_SECTIONS[section]) {
        throw new Error(`Section ${section} not found`);
    }

    const deleteOperation = API_SECTIONS[section].operations.delete;
    if (!deleteOperation) {
        throw new Error(`Delete operation not found in section ${section}`);
    }

    // If using multi-step mutations, execute the mutation chain
    if (deleteOperation.mutations && Array.isArray(deleteOperation.mutations)) {
        return executeMultiStepMutation(deleteOperation.mutations, params);
    }

    // If using a simple query, execute it directly
    return executeGraphQLOperation(deleteOperation, params);
}

/**
 * Perform a bulk delete operation
 * @param {string} section - API section name
 * @param {Array} items - Array of items to delete (usually just IDs)
 * @returns {Promise<Array>} Array of delete operation results
 */
export async function bulkDelete(section, items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return [];
    }

    // Get the delete operation for this section
    if (!API_SECTIONS[section]) {
        throw new Error(`Section ${section} not found`);
    }

    const deleteOperation = API_SECTIONS[section].operations.delete;
    if (!deleteOperation) {
        throw new Error(`Delete operation not found in section ${section}`);
    }

    // Process delete operations in parallel
    const results = await Promise.allSettled(
        items.map(item => deleteEntity(section, item))
    );

    // Format results
    return results.map((result, index) => ({
        item: items[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
    }));
}

/**
 * Perform a partial update on one entity
 * @param {string} section - API section name
 * @param {string} operation - Update operation name within the section
 * @param {Object} params - Parameters for the update
 * @returns {Promise<Object>} Update operation result
 */
export function partialUpdate(section, operation, params = {}) {
    if (!section || !operation) {
        throw new Error('Missing section or operation');
    }

    if (!API_SECTIONS[section]) {
        throw new Error(`Section ${section} not found`);
    }

    const queryDef = API_SECTIONS[section].operations[operation];
    if (!queryDef) {
        throw new Error(`Operation ${operation} not found in section ${section}`);
    }

    return performPartialUpdate(queryDef, params);
}

/**
 * Perform bulk updates on multiple items
 * @param {string} section - API section name
 * @param {string} operation - Update operation name
 * @param {Array} items - Array of items to update
 * @returns {Promise<Array>} Array of update operation results
 */
export async function bulkUpdate(section, operation, items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return [];
    }

    if (!API_SECTIONS[section]) {
        throw new Error(`Section ${section} not found`);
    }

    const queryDef = API_SECTIONS[section].operations[operation];
    if (!queryDef) {
        throw new Error(`Operation ${operation} not found in section ${section}`);
    }

    const results = await performBulkUpdate(queryDef, items);
    return results;
}

// Create a store with our GraphQL utility functions
export function useGraphQL() {
    return {
        executeQuery,
        partialUpdate,
        bulkUpdate,
        deleteEntity,
        bulkDelete
    };
} 