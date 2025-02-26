import { buildSchema } from 'drizzle-graphql';
import { sql } from 'drizzle-orm';

export function createGraphQLSchema(db) {
    // Get the schema from drizzle-graphql
    const drizzleResult = buildSchema(db, {
        relationsDepthLimit: 3
    });

    // Add our custom resolver to the existing ProjectSelectItem resolvers
    drizzleResult.schema._typeMap.ProjectSelectItem._fields.institutionsCount = {
        name: 'institutionsCount',
        type: drizzleResult.schema._typeMap.Int,
        resolve: async (parent) => {
            const result = await db.run(sql`SELECT COUNT(1) AS count FROM institutions WHERE project_id = ${parent.id}`);
            return Number(result.rows[0]['count'] ?? 0);
        },
        args: [],
        extensions: {},
        astNode: undefined
    };

    return { schema: drizzleResult.schema, resolvers: drizzleResult.resolvers };
} 