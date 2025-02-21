import { buildSchema } from 'drizzle-graphql';

export function createGraphQLSchema(db) {
    // Get the schema from drizzle-graphql
    const { schema: drizzleSchema, resolvers } = buildSchema(db, {
        relationsDepthLimit: 1
    });

    return { schema: drizzleSchema, resolvers };
} 