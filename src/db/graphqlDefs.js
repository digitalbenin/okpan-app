import { buildSchema } from 'drizzle-graphql';

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
            const institutions = await db.query.institutions.findMany({
                where: (institutions, { eq }) => eq(institutions.project_id, parent.id)
            });
            return institutions.length;
        },
        args: [],
        extensions: {},
        astNode: undefined
    };

    return { schema: drizzleResult.schema, resolvers: drizzleResult.resolvers };
} 