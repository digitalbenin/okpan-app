/**
 * IPC handler for GraphQL query execution.
 * @namespace backend.handlers.graphqlHandler
 * @memberof backend.handlers
 */
import { graphql } from 'graphql';

/**
 * Execute a GraphQL query against the provided schema and resolvers.
 * @memberof backend.handlers.graphqlHandler
 * @param {Electron.IpcMainInvokeEvent} _event - IPC event.
 * @param {Object} payload - Query payload with `query` and optional `variables`.
 * @param {Object} context - Execution context.
 * @returns {Promise<Object>} Result object containing either `data` or `errors`.
 */
export const handleGraphQL = async (_event, { query, variables }, { schema, resolvers, db }) => {
    try {
        const result = await graphql({
            schema,
            source: query,
            rootValue: resolvers,
            variableValues: variables,
            contextValue: { db }
        });

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
