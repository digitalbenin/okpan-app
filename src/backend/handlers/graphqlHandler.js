import { graphql } from 'graphql';

/**
 * Handler for executing GraphQL queries
 * @param {Object} event - The IPC event
 * @param {Object} params - Query parameters
 * @param {string} params.query - The GraphQL query string
 * @param {Object} params.variables - Variables for the GraphQL query
 * @param {Object} options - Additional options
 * @param {Object} options.schema - GraphQL schema
 * @param {Object} options.resolvers - GraphQL resolvers
 * @param {Object} options.db - Database connection
 * @returns {Promise<Object>} Result of the GraphQL query
 */
export const handleGraphQL = async (event, { query, variables }, { schema, resolvers, db }) => {
    try {
        console.log('Executing GraphQL query:', query, 'with variables:', variables);

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
        console.error('Error executing GraphQL query:', error);
        return { success: false, error: error.message };
    }
}; 