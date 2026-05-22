/**
 * Custom GraphQL resolver factories for institutionsBulkUpdate related database queries and mutations.
 *
 * @namespace db.customQueries.institutionsBulkUpdate
 */
import { eq } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema.js';

// Only these columns may be changed via a bulk update. This prevents arbitrary
// writes to columns that should not be modified this way (e.g. id, project_id, created_at).
const ALLOWED_UPDATE_FIELDS = new Set([
    'status', 'name_id', 'description_id', 'country_id',
    'location_id', 'lon', 'lat', 'website', 'links', 'logo'
]);

export const createInstitutionsBulkUpdateMutation = (db, drizzleResult) => {
    return {
        name: 'bulkUpdateInstitutions',
        type: new GraphQLList(drizzleResult.schema._typeMap.InstitutionsSelectItem),
        args: [
            {
                name: 'updates',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.JSON))),
                description: 'Array of institution updates, each containing an id and the fields to change'
            }
        ],
        resolve: async (source, args) => {
            if (!args.updates || args.updates.length === 0) {
                throw new Error('At least one update is required');
            }

            // GraphQLJSON.parseValue serialises each element to a JSON string before it reaches here.
            const updates = args.updates.map((item, i) => {
                const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                if (!parsed || typeof parsed !== 'object' || !parsed.id) {
                    throw new Error(`Update at index ${i} is missing a required id`);
                }
                return parsed;
            });

            const results = await db.transaction(async (tx) => {
                return Promise.all(updates.map(({ id, ...fields }) => {
                    const safeFields = Object.fromEntries(
                        Object.entries(fields).filter(([key]) => ALLOWED_UPDATE_FIELDS.has(key))
                    );
                    return tx.update(dbSchema.institutions)
                        .set({ ...safeFields, updated_at: new Date() })
                        .where(eq(dbSchema.institutions.id, id))
                        .returning();
                }));
            });

            return results.flat();
        }
    };
};

