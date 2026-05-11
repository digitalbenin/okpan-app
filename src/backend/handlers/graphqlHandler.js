import { graphql } from 'graphql';

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
