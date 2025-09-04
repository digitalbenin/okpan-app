import { sql, eq } from 'drizzle-orm';
import * as dbSchema from '../schema.js';

export const createResearchFieldObjectsCountQuery = (db, drizzleResult) => {
    return {
        name: 'researchFieldObjectsCount',
        type: drizzleResult.schema._typeMap.Int,
        args: [
            {
                name: 'fieldId',
                type: drizzleResult.schema._typeMap.String,
                description: 'ID of the research field to count objects for'
            }
        ],
        resolve: async (source, args, context, info) => {
            // Count objects that have values for this research field
            const countQuery = db
                .select({ count: sql`count(*)` })
                .from(dbSchema.objects_research_fields)
                .where(eq(dbSchema.objects_research_fields.field_id, args.fieldId));

            const result = await countQuery.execute();
            return result[0]?.count || 0;
        }
    };
};
