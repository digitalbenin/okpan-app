import { z } from 'zod';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import * as schema from '../../db/schema.js';
import { API_SECTIONS } from '../queries/index.js';


const customValidatorsRegistry = new Map();

/**
 * Registers a custom validator for a specific entity and field
 */
export const registerCustomValidator = (entityName, fieldName, validatorConfig) => {
    if (!customValidatorsRegistry.has(entityName)) {
        customValidatorsRegistry.set(entityName, new Map());
    }

    customValidatorsRegistry.get(entityName).set(fieldName, validatorConfig);
};

/**
 * Gets a custom validator for a specific entity and field
 */
function getCustomValidator(entityName, fieldName) {
    const entityValidators = customValidatorsRegistry.get(entityName);
    if (!entityValidators) return null;

    return entityValidators.get(fieldName) || null;
}

/**
 * Checks if a custom validator exists for a specific entity and field
 */
function hasCustomValidator(entityName, fieldName) {
    return customValidatorsRegistry.has(entityName) &&
        customValidatorsRegistry.get(entityName).has(fieldName);
}

// =============================================================================

// Get all schema tables
const schemaEntries = Object.entries(schema).filter(([key, value]) =>
    !key.includes('Relations') &&
    typeof value === 'object' &&
    value !== null &&
    typeof value.getSQL === 'function' // Drizzle table indicator
);

// Cache for validation results
const validationCache = new Map();

/**
 * Analyzes mutation variables to understand field requirements and relationships
 */
function analyzeMutationStructure(operation) {
    const analysis = {
        variables: {},
        relationships: new Map(),
        contexts: new Map()
    };

    // If it's a multi-step mutation, analyze all steps
    if (operation.mutations && Array.isArray(operation.mutations)) {
        operation.mutations.forEach(mutation => {
            if (mutation.useVariables) {
                mutation.useVariables.forEach(varName => {
                    analysis.variables[varName] = {
                        usedIn: mutation.name,
                        context: extractContextFromQuery(mutation.query)
                    };
                });
            }

            // Analyze mapped variables to understand relationships
            if (mutation.mapVariables) {
                Object.entries(mutation.mapVariables).forEach(([targetVar, mapping]) => {
                    analysis.relationships.set(targetVar, {
                        sourceStep: mapping.from,
                        sourcePath: mapping.path
                    });
                });
            }

            // Extract context information
            const context = extractContextFromQuery(mutation.query);
            if (context) {
                analysis.contexts.set(mutation.name, context);
            }
        });
    } else if (operation.variables) {
        // Single mutation - analyze variables directly
        Object.entries(operation.variables).forEach(([varName, description]) => {
            analysis.variables[varName] = {
                description,
                context: extractContextFromQuery(operation.query)
            };
        });
    }

    return analysis;
}

/**
 * Extracts table/context information from GraphQL query
 */
function extractContextFromQuery(query) {
    if (!query) return null;

    // Look for insertInto patterns
    const insertMatch = query.match(/insertInto(\w+)/);
    if (insertMatch) {
        return insertMatch[1].toLowerCase();
    }

    // Look for update patterns
    const updateMatch = query.match(/update(\w+)/);
    if (updateMatch) {
        return updateMatch[1].toLowerCase();
    }

    // Look for context in text creation
    const contextMatch = query.match(/context:\s*"([^"]+)"/);
    if (contextMatch) {
        return contextMatch[1];
    }

    return null;
}

/**
 * Maps field names to schema table structures
 */
function mapFieldToSchemaTable(fieldName, contexts, schemaEntries) {
    // First check if field name directly matches a table
    const directMatch = schemaEntries.find(([tableName]) =>
        tableName.toLowerCase() === fieldName.toLowerCase() ||
        tableName.toLowerCase() === fieldName.toLowerCase() + 's'
    );

    if (directMatch) {
        return directMatch[0];
    }

    // Check contexts for table mapping
    for (const [step, context] of contexts) {
        if (context && context.includes('.')) {
            const [tableName] = context.split('.');
            const tableMatch = schemaEntries.find(([name]) =>
                name.toLowerCase().includes(tableName.toLowerCase())
            );
            if (tableMatch) {
                return tableMatch[0];
            }
        }
    }
    return null;
}

/**
 * Gets the appropriate drizzle schema for a table
 */
function getDrizzleSchema(tableName, operationType = 'insert') {
    const tableEntry = Object.entries(schema).find(([key, value]) =>
        key.toLowerCase() === tableName.toLowerCase() &&
        !key.includes('Relations') &&
        typeof value === 'object' &&
        value !== null &&
        typeof value.getSQL === 'function'
    );

    if (!tableEntry) {
        return null;
    }

    const [, table] = tableEntry;

    try {
        switch (operationType.toLowerCase()) {
            case 'insert':
            case 'create':
                return { zodSchema: createInsertSchema(table), drizzleTable: table };
            case 'update':
                return { zodSchema: createUpdateSchema(table), drizzleTable: table };
            case 'select':
                return { zodSchema: createSelectSchema(table), drizzleTable: table };
            default:
                return { zodSchema: createInsertSchema(table), drizzleTable: table };
        }
    } catch (error) {
        console.warn(`Could not create schema for table ${tableName}:`, error);
        return null;
    }
}

/**
 * Checks if a field is required based on Drizzle column definition
 */
function isFieldRequiredBySchema(drizzleTable, fieldName) {
    try {
        // Access column directly from the Drizzle table (this is the working approach)
        if (drizzleTable[fieldName]) {
            const column = drizzleTable[fieldName];

            // Check if it has notNull property
            if (column && typeof column === 'object') {
                return column.notNull === true;
            }
        }

        // Fallback: field not found or no notNull property
        return false;
    } catch (error) {
        console.warn(`Could not check field requirement for ${fieldName}:`, error);
        return false;
    }
}

/**
 * Determines if a form field is required by analyzing the mutation flow
 */
function isFormFieldRequired(fieldName, mutationAnalysis, schemaEntries) {
    // First check if it's a mapped field (e.g., name → nameId → name_id)
    for (const [targetVar, mapping] of mutationAnalysis.relationships) {
        if (mapping.sourceStep && fieldName in mutationAnalysis.variables) {
            const fieldInfo = mutationAnalysis.variables[fieldName];

            if (fieldInfo.usedIn === mapping.sourceStep) {
                // This field creates a text record that maps to targetVar
                // Check if targetVar corresponds to a required field
                const targetFieldName = targetVar.replace(/Id$/, '_id'); // nameId → name_id

                // Find the institutions table and check the target field
                const institutionsTable = schemaEntries.find(([name]) =>
                    name.toLowerCase() === 'institutions'
                );

                if (institutionsTable) {
                    const [, table] = institutionsTable;
                    return isFieldRequiredBySchema(table, targetFieldName);
                }
            }
        }
    }

    // Then check if it's a direct schema field (e.g., website, links, status)
    const institutionsTable = schemaEntries.find(([name]) =>
        name.toLowerCase() === 'institutions'
    );

    if (institutionsTable) {
        const [, table] = institutionsTable;
        const isRequired = isFieldRequiredBySchema(table, fieldName);

        // Only return if we actually found the field
        if (table[fieldName]) {
            return isRequired;
        }
    }
    return false; // Default to optional
}

/**
 * Generates Zod validation schema based on mutation analysis and database schema
 */
function generateValidationSchema(entityName, mutationAnalysis, schemaEntries, operationType = 'insert') {
    const validationRules = {};
    const requiredFields = new Set();



    Object.entries(mutationAnalysis.variables).forEach(([fieldName, fieldInfo]) => {
        let validator = null;
        let isFieldRequired = false;

        // 1. First check for custom validators
        const customValidator = getCustomValidator(entityName, fieldName);

        if (customValidator) {
            // Apply custom validator configuration
            if (typeof customValidator.validator === 'function') {
                validator = customValidator.validator();
            } else if (customValidator.validator) {
                validator = customValidator.validator;
            }

            // Check if custom validator specifies field requirements
            isFieldRequired = customValidator.required || false;

            // If we have a custom validator, use it and skip schema lookup
            if (validator) {
                if (isFieldRequired) {
                    requiredFields.add(fieldName);
                }
                validationRules[fieldName] = validator;
                return; // Skip to next field
            }
        }

        // 2. Try to get validation from database schema
        const schemaTable = mapFieldToSchemaTable(fieldName, mutationAnalysis.contexts, schemaEntries);

        if (schemaTable) {
            const schemaInfo = getDrizzleSchema(schemaTable, operationType);
            console.log(`Processing field ${fieldName} -> table ${schemaTable}`, schemaInfo);
            if (schemaInfo) {
                try {
                    const { zodSchema, drizzleTable } = schemaInfo;
                    const schemaShape = zodSchema.shape || zodSchema._def?.shape();

                    if (schemaShape && schemaShape[fieldName]) {
                        validator = schemaShape[fieldName];

                        // For direct schema fields, check if they're required
                        isFieldRequired = isFieldRequiredBySchema(drizzleTable, fieldName);

                        // Enhance validator based on field requirements
                        if (validator._def?.typeName === 'ZodString' && isFieldRequired) {
                            // Make sure required string fields have minimum length
                            validator = validator.min(1, 'This field is required');
                        }
                    } else {
                        // Look for similar field names in schema
                        const similarField = Object.keys(schemaShape || {}).find(key => {
                            const normalizedKey = key.toLowerCase().replace(/_/g, '');
                            const normalizedField = fieldName.toLowerCase().replace(/_/g, '');
                            return normalizedKey.includes(normalizedField) || normalizedField.includes(normalizedKey);
                        });

                        if (similarField && schemaShape[similarField]) {
                            validator = schemaShape[similarField];

                            // Check if field is required based on Drizzle schema (use the similar field name from schema)
                            isFieldRequired = isFieldRequiredBySchema(drizzleTable, similarField);

                            // Enhance validator based on field requirements
                            if (validator._def?.typeName === 'ZodString' && isFieldRequired) {
                                validator = validator.min(1, 'This field is required');
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Could not process schema for table ${schemaTable}:`, error);
                }
            }
        }

        // If no schema validator found, determine requirement from mutation flow
        if (!validator) {
            // Use mutation analysis to determine if field is required
            isFieldRequired = isFormFieldRequired(fieldName, mutationAnalysis, schemaEntries);

            // Create appropriate validator based on whether field is required
            if (isFieldRequired) {
                validator = z.string().min(1, 'This field is required');
            } else {
                validator = z.string().optional();
            }
        }

        // Track required fields
        if (isFieldRequired) {
            requiredFields.add(fieldName);
        }

        validationRules[fieldName] = validator;
    });

    // Ensure custom validators registered for the entity are included
    try {
        if (customValidatorsRegistry.has(entityName)) {
            const entityCustoms = customValidatorsRegistry.get(entityName);
            for (const [customFieldName, cfg] of entityCustoms.entries()) {
                if (!(customFieldName in validationRules)) {
                    let v = null;
                    if (typeof cfg.validator === 'function') {
                        v = cfg.validator();
                    } else if (cfg.validator) {
                        v = cfg.validator;
                    }
                    if (v) {
                        validationRules[customFieldName] = v;
                        if (cfg.required) {
                            requiredFields.add(customFieldName);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Failed to merge custom validators:', e);
    }

    const finalSchema = z.object(validationRules);

    return {
        schema: finalSchema,
        requiredFields
    };
}


/**
 * Gets validation schema for a specific query operation
 */
export const getValidator = (entityName, operationName) => {
    const cacheKey = `${entityName}.${operationName}`;

    if (validationCache.has(cacheKey)) {
        return validationCache.get(cacheKey);
    }

    try {
        // Get the operation from API_SECTIONS
        const apiSection = API_SECTIONS[entityName];
        if (!apiSection) {
            throw new Error(`Entity '${entityName}' not found in API sections`);
        }

        const operation = apiSection.operations[operationName];
        if (!operation) {
            throw new Error(`Operation '${operationName}' not found for entity '${entityName}'`);
        }

        // Analyze the mutation structure
        const mutationAnalysis = analyzeMutationStructure(operation);

        // Generate validation schema
        const validationResult = generateValidationSchema(
            entityName,
            mutationAnalysis,
            schemaEntries,
            operationName
        );

        // Cache the result
        const validator = {
            schema: validationResult.schema,
            requiredFields: validationResult.requiredFields,
            analysis: mutationAnalysis,
            validate: (data) => validationResult.schema.safeParse(data)
        };

        validationCache.set(cacheKey, validator);
        return validator;

    } catch (error) {
        console.error(`Failed to generate validator for ${entityName}.${operationName}:`, error);

        // Return a basic validator to prevent crashes
        return {
            schema: z.object({}),
            requiredFields: new Set(),
            analysis: { variables: {}, relationships: new Map(), contexts: new Map() },
            validate: (data) => ({ success: true, data })
        };
    }
};

/**
 * Gets field-level validators for TanStack Form
 */
export const getFieldValidators = (entityName, operationName) => {
    const validator = getValidator(entityName, operationName);
    const fieldValidators = {};

    if (validator.schema.shape) {
        Object.entries(validator.schema.shape).forEach(([fieldName, fieldSchema]) => {
            fieldValidators[fieldName] = {
                onSubmit: ({ value }) => {
                    const result = fieldSchema.safeParse(value);
                    if (!result.success) {
                        return result.error.errors[0].message;
                    }
                    return undefined;
                }
            };
        });
    }

    return fieldValidators;
};

/**
 * Creates a field validator for TanStack Form with structured error support
 * @param {string} fieldName - The name of the field to validate
 * @param {Object} validator - The validator object with schema
 * @param {Object} form - The form instance
 * @param {Function} setStructuredErrors - Function to update structured errors (optional)
 * @param {Object} options - Configuration options
 * @returns {Object} Validator configuration for TanStack Form
 */
export const createFieldValidator = (fieldName, validator, form, setStructuredErrors = null, options = {}) => {
    const { validateOnChange = false } = options;

    const validateField = ({ value }) => {
        // Get the field schema from the main validator
        const fieldSchema = validator.schema.shape[fieldName];

        if (!fieldSchema) {
            console.warn(`No schema found for field: ${fieldName}`);
            return undefined;
        }

        // Validate only this specific field
        const result = fieldSchema.safeParse(value);

        if (!result.success) {
            // Update structured errors for components that need them (like DynamicArrayField)
            if (setStructuredErrors && fieldName === "links") {
                // For individual field validation, we need to create error objects with proper paths
                const linksErrors = result.error.errors.map(error => ({
                    ...error,
                    path: [fieldName, ...error.path] // Prepend the field name to the path
                }));
                setStructuredErrors(linksErrors);
            }

            // Return field-specific errors
            const fieldErrors = result.error.errors.map((e) => e.message);
            return fieldErrors.length > 0 ? fieldErrors.join(", ") : undefined;
        } else {
            // Clear structured errors on success
            if (setStructuredErrors && fieldName === "links") {
                setStructuredErrors([]);
            }
        }

        return undefined;
    };

    const config = {
        onSubmit: validateField,
    };

    // Only add onChange validation if explicitly requested
    if (validateOnChange) {
        config.onChange = validateField;
    }

    return config;
};

/**
 * Gets form configuration for TanStack Form
 */
export const getFormConfig = (entityName, operationName, options = {}) => {
    const validator = getValidator(entityName, operationName);
    const fieldValidators = getFieldValidators(entityName, operationName);

    return {
        validators: {
            onChange: validator.schema
        },
        defaultValues: generateDefaultValues(entityName, validator.analysis),
        fieldValidators,
        onSubmit: options.onSubmit || (() => { }),
        ...options
    };
};

/**
 * Generates default values based on field analysis
 */
export const generateDefaultValues = (entityName, analysis) => {
    const defaults = {};

    Object.entries(analysis.variables).forEach(([fieldName, fieldInfo]) => {
        // Check for custom default values first
        const customValidator = getCustomValidator(entityName, fieldName);
        if (customValidator && customValidator.defaultValue !== undefined) {
            defaults[fieldName] = customValidator.defaultValue;
        } else {
            defaults[fieldName] = '';
        }
    });

    return defaults;
};

// =============================================================================
// CUSTOM VALIDATORS REGISTRATION
// =============================================================================

registerCustomValidator('institutions', 'links', {
    validator: () => z.array(z.object({
        url: z.string().refine((val) => {
            // Allow empty strings, but if provided, must be valid URL
            const trimmedVal = val?.trim() || '';
            if (!trimmedVal) {
                return true; // Empty is allowed
            }
            const urlResult = z.string().url().safeParse(trimmedVal);
            return urlResult.success;
        }, 'Must be a valid URL if provided'),
        label: z.string() // Allow empty labels
    })).min(0, 'At least 0 links allowed').max(10, 'Maximum 10 links allowed'),
    required: false,
    defaultValue: [{ url: '', label: '' }],
    // Optional: Custom transformation function
    transform: (value) => {
        // Filter out empty entries and convert to API format
        if (!Array.isArray(value)) return [];
        return value.filter(item => item.url?.trim() && item.label?.trim());
    }
});

// Website field validator for institutions
registerCustomValidator('institutions', 'website', {
    validator: () => z.string().refine((val) => {
        // Allow empty strings, but if provided, must be valid URL
        const trimmedVal = val?.trim() || '';
        if (!trimmedVal) {
            return true; // Empty is allowed since field is optional
        }
        const urlResult = z.string().url().safeParse(trimmedVal);
        return urlResult.success;
    }, 'Must be a valid URL if provided'),
    required: false,
    defaultValue: ''
});

// =============================================================================
// DATASOURCES VALIDATORS
// =============================================================================

// Only keep custom validators for fields that need special handling
// Let the default schema validation handle basic fields like name, method, notes, etc.

// Institution ID validator - required field (not in schema)
registerCustomValidator('datasources', 'institutionId', {
    validator: () => z.string().min(1, 'Please select an institution'),
    required: true,
    defaultValue: ''
});

// Template ID validator - optional field (not in schema)
registerCustomValidator('datasources', 'templateId', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: ''
});

// Language ID validator - required field for text creation (not in schema)
registerCustomValidator('datasources', 'languageId', {
    validator: () => z.string().min(1, 'Language is required'),
    required: true,
    defaultValue: ''
});

// Date validator - required field with ISO date validation (not in schema)
registerCustomValidator('datasources', 'date', {
    validator: () => z.string().refine((val) => {
        if (!val || val.trim() === '') return false; // Don't allow empty
        const date = new Date(val);
        return !isNaN(date.getTime());
    }, 'Must be a valid date'),
    required: true,
    defaultValue: new Date().toISOString()
});
