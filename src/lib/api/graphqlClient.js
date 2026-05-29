import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { addToast } from "$lib/components/base/BaseToast.svelte";
import { API_SECTIONS } from "$lib/queries/index.js";
import { translationsOperations } from "$lib/queries/translations.js";
import { languagesOperations } from "$lib/queries/languages.js";

const { error: logError } = getLogStore();

/**
 * @namespace frontend.api.graphqlClient
 */

/**
 * Executes a GraphQL query with enhanced error handling.
 * @memberOf frontend.api.graphqlClient
 * @method
 * @param {Object} query - Query definition with query string and name.
 * @param {Object} params - Parameters for the query.
 * @param {Object} context - Optional context for workflow tracking.
 * @returns {Promise.<Object>} Query result.
 * @throws {Error} If the query fails or contains GraphQL errors.
 */
export const performQuery = async (query, params, context) => {
    let result = null;
    try {
        const response = await window.api.executeGraphQL(query.query, params, context);

        // Electron IPC GraphQL handler returns { success: boolean, data?: object, errors?: [], error?: string }
        // Normalize failures into thrown Errors so callers don't receive undefined.
        if (!response?.success) {
            const firstGqlMessage = Array.isArray(response?.errors) ? response.errors[0]?.message : null;
            const errorMessage = firstGqlMessage || response?.error || 'GraphQL execution failed';
            const err = new Error(errorMessage);
            err.graphqlErrors = response?.errors;
            err.graphqlResponse = response;
            throw err;
        }

        result = response.data;

        if (result === undefined || result === null) {
            throw new Error('GraphQL returned no data');
        }

        // Check for GraphQL errors in the response (GraphQL can return data with errors)
        if (result && result.errors) {
            const errorMessage = result.errors[0]?.message || 'GraphQL operation failed';
            console.error('GraphQL operation errors:', result.errors);

            addToast({
                data: {
                    title: "GraphQL Error",
                    description: `Error in ${query.name}: ${errorMessage}`,
                    type: "error"
                }
            });

            await logError(query.name, errorMessage);

            const error = new Error(errorMessage);
            error.graphqlErrors = result.errors;
            error.graphqlResult = result;
            throw error;
        }

        // Success
        return result;
    } catch (error) {
        // Handle network/execution errors (different from GraphQL errors in the response)
        if (!error.graphqlErrors) {
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to fetch query ${query.name}: ${error.message}`,
                    type: "error"
                }
            });
            await logError(query.name, error.message);
        }
        throw error;
    }
}

/**
 * Executes a chain of mutations in sequence.
 * @memberOf frontend.api.graphqlClient
 * @param {Array.<Object>} mutations - Array of mutation definitions.
 * @param {Object} params - Parameters for the mutations.
 * @returns {Promise.<Object>} Final operation result.
 */
export async function executeMultiStepMutation(mutations, params) {
    if (!mutations || !Array.isArray(mutations) || mutations.length === 0) {
        throw new Error("Invalid mutation chain");
    }

    // Generate workflow ID for this multi-step operation
    const workflowId = crypto.randomUUID();

    // Store intermediate results for using in subsequent steps
    const results = {};
    const finalResults = {};

    for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        // Handle translation processing step
        if (mutation.processTranslations) {
            const context = {
                workflowId,
                isMultiStep: true,
                stepIndex: i,
                totalSteps: mutations.length,
                stepName: mutation.name
            };
            const translationResult = await processTranslationStep(mutation, params, results, context);
            if (translationResult !== null) {
                results[mutation.name] = translationResult;
                Object.assign(finalResults, translationResult);
            }
            continue;
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
                const { from, path, skipIfUndefined } = mapping;
                if (!results[from]) {
                    if (skipIfUndefined) {
                        // Skip this variable mapping if the source mutation was skipped
                        continue;
                    } else {
                        console.warn(`Missing dependency: ${from} for variable ${targetVar}`);
                        continue;
                    }
                }

                // Get value from the specified path
                let value = results[from];
                const pathParts = path.split('.');

                for (const part of pathParts) {
                    if (value === undefined || value === null) break;
                    value = value[part];
                }

                if (value !== undefined && value !== null) {
                    stepVariables[targetVar] = value;
                } else if (skipIfUndefined) {
                    // Skip this variable mapping if the value is undefined/null and skipIfUndefined is true
                    continue;
                }
            }
        }

        // Check onlyIf condition first (run step ONLY if condition is met)
        if (mutation.onlyIf) {
            const { from, path, isNull } = mutation.onlyIf;

            if (results[from]) {
                let value = results[from];
                const pathParts = path.split('.');

                for (const part of pathParts) {
                    if (value === undefined || value === null) break;
                    value = value[part];
                }

                if (isNull && value !== null) {
                    continue;
                } else if (!isNull && value === null) {
                    continue;
                }
            }
        }

        // Skip this step if the skipIf condition is met (check AFTER variable mapping)
        if (mutation.skipIf) {
            const { variableName, isUndefined, isEmpty } = mutation.skipIf;

            let shouldSkip = false;

            if (isUndefined !== undefined) {
                const value = stepVariables[variableName];
                // Treat undefined strictly; allow null to pass through so mutations can explicitly clear fields
                const valueIsUndefined = value === undefined;
                shouldSkip = (isUndefined && valueIsUndefined) || (!isUndefined && !valueIsUndefined);
            }

            if (isEmpty !== undefined) {
                const value = stepVariables[variableName];
                const valueIsEmpty = value === undefined || value === null || value === '';
                shouldSkip = shouldSkip || (isEmpty && valueIsEmpty) || (!isEmpty && !valueIsEmpty);
            }

            if (shouldSkip) {
                continue;
            }
        }

        // Execute this step with workflow context
        try {
            const context = {
                workflowId,
                isMultiStep: true,
                stepIndex: i,
                totalSteps: mutations.length,
                stepName: mutation.name
            };

            const result = await performQuery({ name: mutation.name, query: mutation.query }, stepVariables, context);
            results[mutation.name] = result;
            Object.assign(finalResults, result);
        } catch (error) {
            if (mutation.continueOnError) {
                console.warn(`Step ${mutation.name} failed (continuing):`, error.message);
                continue;
            }
            console.error(`Error in mutation step ${mutation.name}:`, error);
            throw error;
        }
    }

    return finalResults;
}

/**
 * Processes a translation step by handling an array of translations.
 * @memberOf frontend.api.graphqlClient
 * @param {Object} mutation - The translation processing step configuration.
 * @param {Object} params - Original parameters.
 * @param {Object} results - Results from previous steps.
 * @param {Object} context - Workflow context for this multi-step operation.
 * @returns {Promise.<Object|null>} Translation processing results.
 */
async function processTranslationStep(mutation, params, results, context) {
    const { processTranslations } = mutation;
    const { textIdPath, textIdPaths, translationsParam } = processTranslations;

    // Get the text ID from previous results
    const resolvePath = (path) => {
        const pathParts = path.split('.');
        let value = results;
        for (const part of pathParts) {
            if (value === undefined || value === null) break;
            value = value[part];
        }
        return value;
    };

    let textId = null;
    const candidatePaths = Array.isArray(textIdPaths)
        ? textIdPaths
        : textIdPath
          ? [textIdPath]
          : [];

    for (const path of candidatePaths) {
        const value = resolvePath(path);
        if (value !== undefined && value !== null && value !== '') {
            textId = value;
            break;
        }
    }

    // Get the translations array from params
    const translations = params[translationsParam];

    if (!translations || !Array.isArray(translations) || translations.length === 0) {
        return null;
    }

    if (!textId) {
        const pathLabel = candidatePaths.join(' or ');
        console.warn(`No text ID found at path ${pathLabel}, skipping translations`);
        return null;
    }

    const translationResults = [];
    const errors = [];

    // Process each translation
    for (const translation of translations) {
        const { id: translationId, language_code, content } = translation;

        try {
            if (translationId) {
                // Update existing translation
                const result = await performQuery(
                    translationsOperations.update,
                    { id: translationId, content },
                    context
                );
                translationResults.push({ operation: 'update', result });
            } else if (content && language_code) {
                // Create new translation - need to convert language_code to language_id
                const languageResult = await performQuery(
                    languagesOperations.getByCode,
                    { code: language_code },
                    context
                );

                if (languageResult?.result && languageResult.result.length > 0) {
                    const languageId = languageResult.result[0].id;
                    const result = await performQuery(
                        translationsOperations.create,
                        { textId, languageId, content },
                        context
                    );
                    translationResults.push({ operation: 'create', result });
                }
            }
        } catch (err) {
            console.error(`Error processing translation:`, err);
            errors.push(`Failed to process translation for language ${language_code}: ${err.message}`);
        }
    }

    const result = {
        translationResults,
        errors: errors.length > 0 ? errors : null,
        processedCount: translationResults.length
    };

    return result;
}

// --- Dev / test utilities ---
// These functions support admin and test pages, and are exposed via useGraphQL().

/**
 * Performs bulk delete operations on multiple items.
 * @memberOf frontend.api.graphqlClient
 * @param {string} section - API section name.
 * @param {Array.<*>} items - Array of items to delete (usually just IDs).
 * @returns {Promise.<Array.<{item: *, success: boolean, data: (Object|null), error: (*|null)}>>} Array of delete operation results.
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
    // Using Promise.allSettled to continue even if some operations fail
    // Each operation internally uses performQuery which handles logging and notifications
    const results = await Promise.allSettled(
        items.map(item => deleteEntity(section, item))
    );

    // Format results to include success/error information
    return results.map((result, index) => ({
        item: items[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
    }));
}

/**
 * Performs bulk updates on multiple items.
 * @memberOf frontend.api.graphqlClient
 * @param {string} section - API section name.
 * @param {string} operation - Update operation name.
 * @param {Array.<Object>} items - Array of items to update.
 * @returns {Promise.<Array.<{item: *, success: boolean, data: (Object|null), error: (*|null)}>>} Grouped results of the update operations.
 */
export async function bulkUpdate(section, operation, items) {
    if (!items || !Array.isArray(items) || items.length === 0) return [];
    if (!API_SECTIONS[section]) throw new Error(`Section ${section} not found`);

    const queryDef = API_SECTIONS[section].operations[operation];
    if (!queryDef) throw new Error(`Operation ${operation} not found in section ${section}`);

    const results = await Promise.allSettled(
        items.map(item => queryDef.mutations
            ? executeMultiStepMutation(queryDef.mutations, item)
            : performQuery(queryDef, item)
        )
    );

    return results.map((result, index) => ({
        item: items[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
    }));
}

/**
 * Executes a complex multi-step delete operation based on the configured mutations.
 * @memberOf frontend.api.graphqlClient
 * @param {string} section - API section name.
 * @param {Object} params - Delete parameters.
 * @returns {Promise.<Object>} Delete operation result.
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
    // executeMultiStepMutation uses performQuery internally which handles errors
    if (deleteOperation.mutations && Array.isArray(deleteOperation.mutations)) {
        return executeMultiStepMutation(deleteOperation.mutations, params);
    }

    // performQuery already handles errors, logging, and notifications
    return performQuery(deleteOperation, params);
}

/**
 * Performs a partial update on one entity.
 * @memberOf frontend.api.graphqlClient
 * @param {string} section - API section name.
 * @param {string} operation - Update operation name within the section.
 * @param {Object} params - Parameters for the update.
 * @returns {Promise.<Object>} Update operation result.
 */
export async function partialUpdate(section, operation, params = {}) {
    if (!section || !operation) throw new Error('Missing section or operation');
    if (!API_SECTIONS[section]) throw new Error(`Section ${section} not found`);

    const queryDef = API_SECTIONS[section].operations[operation];
    if (!queryDef) throw new Error(`Operation ${operation} not found in section ${section}`);

    return queryDef.mutations
        ? executeMultiStepMutation(queryDef.mutations, params)
        : performQuery(queryDef, params);
}

/**
 * Performs an operation based on the API_SECTIONS configuration.
 * @memberOf frontend.api.graphqlClient
 * @param {string} section - API section name.
 * @param {string} operation - Operation name within the section.
 * @param {Object} params - Parameters for the operation.
 * @param {Object} context - Optional context for workflow tracking.
 * @returns {Promise.<Object>} Operation result.
 */
export async function executeQuery(section, operation, params = {}, context = null) {
    if (!section || !operation) {
        throw new Error('Missing section or operation');
    }

    if (section === 'custom' && operation === 'mutation' && params.query) {
        return performQuery(params.query, params.params || {}, context);
    }

    if (!API_SECTIONS[section]) {
        throw new Error(`Section ${section} not found`);
    }

    const queryDef = API_SECTIONS[section].operations[operation];
    if (!queryDef) {
        throw new Error(`Operation ${operation} not found in section ${section}`);
    }

    // Check if this is a multi-step mutation
    if (queryDef.mutations && Array.isArray(queryDef.mutations)) {
        return executeMultiStepMutation(queryDef.mutations, params);
    }

    // Otherwise, perform a single query
    // performQuery already handles errors, logging, and notifications
    // Unwrap the `result:` alias only when it is the sole field in the response.
    // Queries that bundle multiple aliases (e.g. `result:` + `count:`) are returned as-is
    // so callers can access every field without losing sibling data.
    const data = await performQuery(queryDef, params, context);
    const keys = data && typeof data === 'object' ? Object.keys(data) : [];
    return keys.length === 1 && keys[0] === 'result' ? data.result : data;
}

/**
 * Returns a store with GraphQL utility functions.
 * @memberOf frontend.api.graphqlClient
 * @returns {Object} Object containing all GraphQL utility functions (executeQuery, partialUpdate, bulkUpdate, deleteEntity, bulkDelete, performQuery).
 */
export function useGraphQL() {
    return {
        executeQuery,
        partialUpdate,
        bulkUpdate,
        deleteEntity,
        bulkDelete,
        performQuery  // Expose the base performQuery for direct use
    };
}