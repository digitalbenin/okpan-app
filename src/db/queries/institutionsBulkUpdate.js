import { sql, eq, inArray } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema.js';

export const createInstitutionsBulkUpdateMutation = (db, drizzleResult) => {
    return {
        name: 'bulkUpdateInstitutions',
        type: new GraphQLList(drizzleResult.schema._typeMap.InstitutionsSelectItem),
        args: [
            {
                name: 'updates',
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.JSON))),
                description: 'Array of institution updates with id and fields to update'
            }
        ],
        resolve: async (source, args, context) => {
            try {
                if (!args.updates || args.updates.length === 0) {
                    throw new Error('At least one update is required');
                }

                console.log('🔍 Bulk update debugging:');
                console.log('Updates received:', args.updates);
                console.log('Updates type:', typeof args.updates[0]);
                console.log('First update raw:', args.updates[0]);

                // Parse updates - handle both individual JSON objects and array-as-string
                let updates;
                try {
                    console.log('🔧 Parsing step by step:');
                    console.log('args.updates.length:', args.updates.length);
                    console.log('typeof args.updates[0]:', typeof args.updates[0]);

                    // Check if we have a single string that represents the entire array
                    if (args.updates.length === 1 && typeof args.updates[0] === 'string') {
                        console.log('🔧 Single string detected, attempting to parse...');
                        let parsed = JSON.parse(args.updates[0]);
                        console.log('🔧 First JSON.parse result:', parsed);
                        console.log('🔧 Is it an array?', Array.isArray(parsed));

                        // Check if we need to parse again (double-encoded JSON)
                        if (typeof parsed === 'string') {
                            console.log('🔧 Still a string, parsing again...');
                            parsed = JSON.parse(parsed);
                            console.log('🔧 Second JSON.parse result:', parsed);
                            console.log('🔧 Is it an array now?', Array.isArray(parsed));
                        }

                        if (Array.isArray(parsed)) {
                            // The string contains the entire array
                            console.log('🔧 Using parsed array directly');
                            updates = parsed;
                        } else {
                            // The string contains a single object
                            console.log('🔧 Wrapping single object in array');
                            updates = [parsed];
                        }
                    } else {
                        console.log('🔧 Multiple elements or non-string detected, mapping...');
                        // Normal case: array of individual JSON strings/objects
                        updates = args.updates.map((update, index) => {
                            console.log(`🔧 Processing update ${index}:`, update, typeof update);
                            if (typeof update === 'string') {
                                const parsed = JSON.parse(update);
                                console.log(`🔧 Parsed update ${index}:`, parsed);
                                return parsed;
                            } else if (typeof update === 'object' && update !== null) {
                                return update;
                            } else {
                                throw new Error(`Invalid update type: ${typeof update}`);
                            }
                        });
                    }
                    console.log('🔧 Final parsed updates:', updates);
                    console.log('🔧 Type of first update:', typeof updates[0]);
                } catch (parseError) {
                    console.error('Error parsing updates:', parseError);
                    throw new Error(`Failed to parse updates: ${parseError.message}`);
                }

                console.log('Parsed updates:', updates);

                // Validate all updates have IDs
                const ids = [];
                for (let i = 0; i < updates.length; i++) {
                    const update = updates[i];
                    console.log(`Update ${i}:`, update);
                    if (!update || typeof update !== 'object') {
                        throw new Error(`Update ${i} is not a valid object`);
                    }
                    if (!update.id) {
                        throw new Error(`Update ${i} is missing id field. Update: ${JSON.stringify(update)}`);
                    }
                    ids.push(update.id);
                }

                console.log('Extracted IDs:', ids);

                // Determine which fields need updating
                const fieldsToUpdate = new Set();
                updates.forEach(update => {
                    Object.keys(update).forEach(key => {
                        if (key !== 'id') fieldsToUpdate.add(key);
                    });
                });

                // Build SET clauses with CASE statements for each field
                const setClauses = {};

                for (const field of fieldsToUpdate) {
                    const cases = [];
                    for (const update of updates) {
                        if (update[field] !== undefined) {
                            cases.push(`WHEN id = '${update.id}' THEN ${typeof update[field] === 'string' ? `'${update[field]}'` : update[field]}`);
                        }
                    }

                    if (cases.length > 0) {
                        setClauses[field] = sql.raw(`CASE ${cases.join(' ')} ELSE ${field} END`);
                    }
                }

                // Always update the timestamp
                setClauses.updated_at = new Date();

                console.log('🔧 Fields to update:', Array.from(fieldsToUpdate));
                console.log('🔧 SET clauses:', setClauses);

                // Execute single optimized update
                const result = await db.update(dbSchema.institutions)
                    .set(setClauses)
                    .where(inArray(dbSchema.institutions.id, ids))
                    .returning()
                    .execute();

                console.log(`✅ Successfully updated ${result.length} institutions`);
                return result;
            } catch (error) {
                console.error('❌ Bulk update institutions error:', error);
                console.error('Error details:', error.message);
                console.error('Stack:', error.stack);
                throw new Error(`Failed to update institutions: ${error.message}`);
            }
        }
    };
}; 