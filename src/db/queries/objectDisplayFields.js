import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql';
import { eq } from 'drizzle-orm';
import * as dbSchema from '../schema';

export const createObjectDisplayFieldsTransformedQuery = (db, drizzleResult) => {
    // Define the transformed type
    const ObjectDisplayFieldTransformed = new GraphQLObjectType({
        name: 'ObjectDisplayFieldTransformed',
        fields: () => ({
            id: { type: GraphQLString },
            type: { type: GraphQLString },
            value: { type: GraphQLString }
        })
    });
    drizzleResult.schema._typeMap.ObjectDisplayFieldTransformed = ObjectDisplayFieldTransformed;

    return {
        name: 'objectDisplayFieldsTransformed',
        type: new GraphQLList(new GraphQLNonNull(ObjectDisplayFieldTransformed)),
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter object display fields by project ID'
            }
        ],
        resolve: async (source, args, context, info) => {
            let query = db
                .select({
                    id: dbSchema.object_display_fields.id,
                    project_id: dbSchema.object_display_fields.project_id,
                    ontology_field_id: dbSchema.object_display_fields.ontology_field_id,
                    research_field_id: dbSchema.object_display_fields.research_field_id,
                    property_name: dbSchema.object_display_fields.property_name
                })
                .from(dbSchema.object_display_fields);

            // Apply project_id filter if specified
            if (args.project_id) {
                query = query.where(eq(dbSchema.object_display_fields.project_id, args.project_id));
            }

            const rawResults = await query.execute();

            // Transform the results
            return rawResults.map(item => {
                let type, value;

                if (item.property_name) {
                    type = 'object_property';
                    value = item.property_name;
                } else if (item.research_field_id) {
                    type = 'research_field';
                    value = item.research_field_id;
                } else if (item.ontology_field_id) {
                    type = 'ontology_field';
                    value = item.ontology_field_id;
                }

                return {
                    id: item.id,
                    type,
                    value
                };
            });
        }
    };
}; 