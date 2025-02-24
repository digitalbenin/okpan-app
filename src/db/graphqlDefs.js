import { buildSchema } from 'drizzle-graphql';
import { sql } from 'drizzle-orm';

export function createGraphQLSchema(db) {
    // Get the schema from drizzle-graphql
    const drizzleResult = buildSchema(db, {
        relationsDepthLimit: 1
    });

    // Add our custom resolver to the existing ProjectSelectItem resolvers
    drizzleResult.schema._typeMap.ProjectSelectItem._fields.institutionsCount = {
        name: 'institutionsCount',
        type: drizzleResult.schema._typeMap.Int,
        resolve: async (parent) => {
            const result = await db.run(sql`SELECT COUNT(1) FROM institutions WHERE project_id = ${parent.id}`);
            return Number(result.rows[0]['COUNT(1)'] ?? 0);
        },
        args: [],
        extensions: {},
        astNode: undefined
    };

    return { schema: drizzleResult.schema, resolvers: drizzleResult.resolvers };
} 