import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import * as schema from '../../db/schema';
import { getLogStore } from "$lib/stores/LogStore.svelte.js";

const { error: logError } = getLogStore();

let storeInstance = null;

export function getValidationStore() {
    if (storeInstance) return storeInstance;

    const validationState = $state({
        schemas: {},
        customSchemas: {},
        isInitialized: false,
        error: null,
    });

    const initializeSchemas = () => {
        const tables = Object.entries(schema).filter(([key]) =>
            !key.includes('Relations')
        );

        tables.forEach(([tableName, table]) => {
            validationState.schemas[tableName] = {
                insert: createInsertSchema(table),
                select: createSelectSchema(table),
                update: createUpdateSchema(table)
            };
        });

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
            update: createUpdateSchema(schema.interface_translations).extend({
                namespace: namespaceSchema.optional(),
                key: translationKeySchema.optional(),
                value: z.string().min(1).optional()
            }),
            namespace: namespaceSchema,
            key: translationKeySchema
        };

        validationState.isInitialized = true;
    };

    initializeSchemas();

    const validate = async (data, targetSchema) => {
        if (!validationState.isInitialized) {
            throw new Error('Validation store not initialized');
        }
        const result = targetSchema.safeParse(data);
        if (!result.success) {
            await logError('validation_error', result.error.errors[0].message);
        }
        return {
            success: result.success,
            errors: result.success ? [] : result.error.errors.map(e => e.message)
        };
    };

    const getSchema = (tableName, type = 'insert') => {
        if (!validationState.isInitialized) throw new Error('Validation store not initialized');
        if (!validationState.schemas[tableName]) throw new Error(`No schema found for table: ${tableName}`);
        return validationState.schemas[tableName][type];
    };

    const getTableNames = () => Object.keys(validationState.schemas);

    const createCustomSchema = (tableName, customValidations = {}, type = 'insert') => {
        const baseSchema = getSchema(tableName, type);
        return baseSchema.extend(customValidations);
    };

    storeInstance = {
        get validationState() { return validationState; },
        validate,
        getSchema,
        getTableNames,
        createCustomSchema,
    };

    return storeInstance;
}

export const validationStore = getValidationStore();
