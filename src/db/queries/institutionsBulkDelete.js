import { inArray } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema.js';

export const createInstitutionsBulkDeleteMutation = (db, drizzleResult) => {
    return {
        name: 'bulkDeleteInstitutions',
        type: new GraphQLList(drizzleResult.schema._typeMap.InstitutionsSelectItem),
        args: [
            {
                name: 'ids',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.String))),
                description: 'Array of institution IDs to delete'
            }
        ],
        resolve: async (source, args) => {
            if (!args.ids || args.ids.length === 0) {
                throw new Error('At least one ID is required');
            }

            // If the caller sends the whole array as a single JSON-encoded string, unwrap it.
            let ids = args.ids;
            if (ids.length === 1 && typeof ids[0] === 'string' && ids[0].startsWith('[')) {
                try {
                    ids = JSON.parse(ids[0]);
                } catch {
                    // Not a JSON array string; treat the single element as a plain ID
                }
            }

            const existingInstitutions = await db.select({ id: dbSchema.institutions.id })
                .from(dbSchema.institutions)
                .where(inArray(dbSchema.institutions.id, ids))
                .execute();

            if (existingInstitutions.length === 0) {
                return [];
            }

            return db.transaction(async (tx) => {
                // Delete related templates before the institutions themselves
                await tx.delete(dbSchema.templates)
                    .where(inArray(dbSchema.templates.institution_id, ids))
                    .execute();

                return tx.delete(dbSchema.institutions)
                    .where(inArray(dbSchema.institutions.id, ids))
                    .returning()
                    .execute();
            });
        }
    };
};
