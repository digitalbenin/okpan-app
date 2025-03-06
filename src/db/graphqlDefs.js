import { buildSchema } from 'drizzle-graphql';
import { sql, eq, aliasedTable } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from './schema';

export function createGraphQLSchema(db) {
    // Get the schema from drizzle-graphql
    const drizzleResult = buildSchema(db, {
        relationsDepthLimit: 3
    });

    // Add our custom resolver to the existing ProjectSelectItem resolvers
    drizzleResult.schema._typeMap.ProjectSelectItem._fields.institutionsCount = {
        name: 'institutionsCount',
        type: drizzleResult.schema._typeMap.Int,
        args: [],
    }

    drizzleResult.schema._typeMap.ProjectSelectItem._fields.objectsCount = {
        name: 'objectsCount',
        type: drizzleResult.schema._typeMap.Int,
        args: [],
    }

    // Add custom query to the Query type
    drizzleResult.schema._typeMap.Query._fields.projectsList = {
        name: 'projectsList',
        type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.ProjectSelectItem)),
        args: [],
        resolve: async (source, args, context, info) => {

            // Create aliases for the texts table
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const titleTexts = aliasedTable(dbSchema.texts, 'title_texts');

            // Subquery to count institutions for each project
            const institutionsSubquery = db
                .select({
                    project_id: dbSchema.institutions.project_id,
                    institutions_count: sql`count(*)`.as('institutions_count')
                })
                .from(dbSchema.institutions)
                .groupBy(dbSchema.institutions.project_id)
                .as('institutions_count');

            const objectsSubquery = db
                .select({
                    project_id: dbSchema.objects.project_id,
                    objects_count: sql`count(*)`.as('objects_count')
                })
                .from(dbSchema.objects)
                .groupBy(dbSchema.objects.project_id)
                .as('objects_count');

            // Use a direct SQL query approach to avoid recursion issues
            const projects = await db.select({
                id: dbSchema.project.id,
                created_at: dbSchema.project.created_at,
                updated_at: dbSchema.project.updated_at,
                description: {
                    content: descriptionTexts.content,
                    id: descriptionTexts.id,
                    original_language: descriptionTexts.original_language
                },
                title: {
                    content: titleTexts.content,
                    id: titleTexts.id,
                    original_language: titleTexts.original_language
                },
                institutionsCount: sql`COALESCE(${institutionsSubquery.institutions_count}, 0)`.as('institutionsCount'),
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount')
            })
                .from(dbSchema.project)
                .leftJoin(descriptionTexts, eq(dbSchema.project.description_id, descriptionTexts.id))
                .leftJoin(titleTexts, eq(dbSchema.project.title_id, titleTexts.id))
                .leftJoin(institutionsSubquery, eq(dbSchema.project.id, institutionsSubquery.project_id))
                .leftJoin(objectsSubquery, eq(dbSchema.project.id, objectsSubquery.project_id))
                .execute();

            return projects;
        }
    }

    return { schema: drizzleResult.schema, resolvers: drizzleResult.resolvers };
};



