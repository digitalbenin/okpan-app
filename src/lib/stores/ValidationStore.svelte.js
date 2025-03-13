import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import * as schema from '../../db/schema';

// Create a singleton instance
let storeInstance = null;

// Main store function that creates and returns the store
export function getValidationStore() {
    // If we already have an instance, return it
    if (storeInstance) {
        return storeInstance;
    }

    // State variables defined inside the function
    const validationState = $state({
        schemas: {},
        customSchemas: {},
        isInitialized: false,
        error: null
    });

    // Initialize schemas for all tables
    const initializeSchemas = () => {
        try {
            // Get all table schemas from the schema file
            const tables = Object.entries(schema).filter(([key, value]) =>
                !key.includes('Relations')
            );

            // Generate schemas for each table
            tables.forEach(([tableName, table]) => {


                validationState.schemas[tableName] = {
                    insert: createInsertSchema(table),
                    select: createSelectSchema(table)
                };
            });

            // Add interface_translations schema with custom rules
            const namespaceSchema = z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, {
                message: "Namespace can only contain lowercase letters, numbers, and underscores"
            });

            const translationKeySchema = z.string().min(1).max(100).regex(/^[a-z0-9_\\.]+$/, {
                message: "Key can only contain lowercase letters, numbers, underscores, and dots"
            });

            validationState.schemas['interface_translations'] = {
                insert: createInsertSchema(schema.interface_translations).extend({
                    namespace: namespaceSchema,
                    key: translationKeySchema,
                    value: z.string().min(1)
                }),
                select: createSelectSchema(schema.interface_translations),
                // Add specific schemas for namespace and key validation
                namespace: namespaceSchema,
                key: translationKeySchema
            };

            validationState.isInitialized = true;
        } catch (err) {
            validationState.error = `Failed to initialize validation schemas: ${err.message}`;
            console.error('Validation schema initialization error:', err);
        }
    };

    // Validate data against a schema
    const validate = async (data, schema) => {
        try {
            if (!validationState.isInitialized) {
                throw new Error('Validation store not initialized');
            }

            const result = schema.safeParse(data);
            return {
                success: result.success,
                errors: result.success ? [] : result.error.errors.map(e => e.message)
            };
        } catch (err) {
            console.error('Validation error:', err);
            return {
                success: false,
                errors: [err.message]
            };
        }
    };

    // Get a specific schema
    const getSchema = (tableName, type = 'insert') => {
        if (!validationState.isInitialized) {
            throw new Error('Validation store not initialized');
        }

        if (!validationState.schemas[tableName]) {
            throw new Error(`No schema found for table: ${tableName}`);
        }

        return validationState.schemas[tableName][type];
    };

    // Get all available table names
    const getTableNames = () => {
        return Object.keys(validationState.schemas);
    };

    // Create a custom schema with additional validations
    const createCustomSchema = (tableName, customValidations = {}, type = 'insert') => {
        try {
            const baseSchema = getSchema(tableName, type);
            return baseSchema.extend(customValidations);
        } catch (err) {
            console.error(`Error creating custom schema for ${tableName}:`, err);
            throw err;
        }
    };

    // Initialize schemas
    if (!validationState.isInitialized) {
        initializeSchemas();
    }

    // Create the store instance
    storeInstance = {
        validationState,
        validate,
        getSchema,
        getTableNames,
        createCustomSchema
    };

    return storeInstance;
}
