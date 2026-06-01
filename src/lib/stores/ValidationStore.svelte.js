import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import * as schema from '../../db/schema';
import { getLogStore } from "$lib/stores/LogStore.svelte.js";

const { error: logError } = getLogStore();

class ValidationStore {
    schemas = $state({});
    customSchemas = $state({});
    isInitialized = $state(false);
    error = $state(null);

    constructor() {
        this.initializeSchemas();
        this.validate = this.validate.bind(this);
        this.getSchema = this.getSchema.bind(this);
        this.getTableNames = this.getTableNames.bind(this);
        this.createCustomSchema = this.createCustomSchema.bind(this);
    }

    initializeSchemas() {
        const tables = Object.entries(schema).filter(([key]) =>
            !key.includes('Relations')
        );

        tables.forEach(([tableName, table]) => {
            this.schemas[tableName] = {
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

        this.schemas['interface_translations'] = {
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

        this.isInitialized = true;
    }

    async validate(data, targetSchema) {
        if (!this.isInitialized) {
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
    }

    getSchema(tableName, type = 'insert') {
        if (!this.isInitialized) {
            throw new Error('Validation store not initialized');
        }

        if (!this.schemas[tableName]) {
            throw new Error(`No schema found for table: ${tableName}`);
        }

        return this.schemas[tableName][type];
    }

    getTableNames() {
        return Object.keys(this.schemas);
    }

    createCustomSchema(tableName, customValidations = {}, type = 'insert') {
        const baseSchema = this.getSchema(tableName, type);
        return baseSchema.extend(customValidations);
    }
}

export const validationStore = new ValidationStore();

// Backward-compatible getter
export function getValidationStore() {
    return validationStore;
}
