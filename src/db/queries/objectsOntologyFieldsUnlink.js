/**
 * Custom GraphQL resolver factories for objectsOntologyFieldsUnlink related database queries and mutations.
 *
 * @namespace db.customQueries.objectsOntologyFieldsUnlink
 */
import { and, eq } from 'drizzle-orm';
import { GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema.js';

export const createObjectsOntologyFieldsUnlinkMutation = (db, drizzleResult) => {
    return {
        name: 'unlinkDatasourceFromObject',
        type: drizzleResult.schema._typeMap.Int,
        args: [
            {
                name: 'object_id',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.String),
                description: 'ID of the object to unlink from the datasource'
            },
            {
                name: 'datasource_id',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.String),
                description: 'ID of the datasource to unlink from the object'
            }
        ],
        resolve: async (source, args) => {
            const { object_id: objectId, datasource_id: datasourceId } = args;

            if (!objectId || !datasourceId) {
                throw new Error('Both object_id and datasource_id are required');
            }

            const deletedRows = await db
                .delete(dbSchema.objects_ontology_fields)
                .where(
                    and(
                        eq(dbSchema.objects_ontology_fields.object_id, objectId),
                        eq(dbSchema.objects_ontology_fields.datasources_id, datasourceId)
                    )
                )
                .returning({ id: dbSchema.objects_ontology_fields.id })
                .execute();

            return deletedRows.length;
        }
    };
};

