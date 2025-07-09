import { inArray, sql } from 'drizzle-orm';
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
        resolve: async (source, args, context) => {
            try {
                if (!args.ids || args.ids.length === 0) {
                    throw new Error('At least one ID is required');
                }

                console.log('🔍 Bulk delete debugging:');
                console.log('IDs received:', args.ids);
                console.log('IDs type:', typeof args.ids[0]);

                // Fix: Parse JSON string if needed
                let idsToDelete = args.ids;
                if (args.ids.length === 1 && typeof args.ids[0] === 'string' && args.ids[0].startsWith('[')) {
                    try {
                        idsToDelete = JSON.parse(args.ids[0]);
                        console.log('📝 Parsed JSON string to array:', idsToDelete);
                    } catch (e) {
                        console.log('❌ Failed to parse JSON string:', e.message);
                    }
                }

                console.log('Final IDs to delete:', idsToDelete);

                // First, check if these institutions actually exist
                const existingInstitutions = await db.select({ id: dbSchema.institutions.id })
                    .from(dbSchema.institutions)
                    .where(inArray(dbSchema.institutions.id, idsToDelete))
                    .execute();

                console.log('Existing institutions found:', existingInstitutions);

                if (existingInstitutions.length === 0) {
                    console.log('❌ No institutions found with provided IDs');
                    return [];
                }

                // Check for dependent records
                const templatesCount = await db.select({ count: sql`count(*)` })
                    .from(dbSchema.templates)
                    .where(inArray(dbSchema.templates.institution_id, idsToDelete))
                    .execute();

                console.log('Templates that reference these institutions:', templatesCount[0]?.count || 0);

                // Use transaction to ensure all related data is properly deleted
                const result = await db.transaction(async (tx) => {
                    console.log('🗑️ Starting deletion transaction...');

                    // Delete related templates first
                    const deletedTemplates = await tx.delete(dbSchema.templates)
                        .where(inArray(dbSchema.templates.institution_id, idsToDelete))
                        .returning({ id: dbSchema.templates.id })
                        .execute();

                    console.log('Deleted templates:', deletedTemplates.length);

                    // Now delete institutions
                    const deletedInstitutions = await tx.delete(dbSchema.institutions)
                        .where(inArray(dbSchema.institutions.id, idsToDelete))
                        .returning()
                        .execute();

                    console.log('Deleted institutions:', deletedInstitutions.length);
                    return deletedInstitutions;
                });

                console.log(`✅ Successfully deleted ${result.length} institutions`);
                return result;
            } catch (error) {
                console.error('❌ Bulk delete institutions error:', error);
                console.error('Error details:', error.message);
                console.error('Stack:', error.stack);
                throw new Error(`Failed to delete institutions: ${error.message}`);
            }
        }
    };
}; 