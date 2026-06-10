import { z } from 'zod';

// Registry: entityName → Map<fieldName, { validator, required, defaultValue, structuredErrors }>
const validatorsRegistry = new Map();
const validationCache = new Map();

/**
 * Registers a Zod validator for a specific entity field.
 * @param {string} entityName
 * @param {string} fieldName
 * @param {{ validator: (Function|Object), required: boolean=, defaultValue: *=, structuredErrors: boolean= }} config
 */
export const registerCustomValidator = (entityName, fieldName, config) => {
    if (!validatorsRegistry.has(entityName)) validatorsRegistry.set(entityName, new Map());
    validatorsRegistry.get(entityName).set(fieldName, config);
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Builds and caches a Zod schema + metadata for an entity from its registered validators.
 * @param {string} entityName
 * @param {string} [operationName] - Kept for API compatibility; validators are per-entity only
 * @returns {{ schema: ZodObject, requiredFields: Set, complexFields: Set, validate: Function }}
 */
export const getValidator = (entityName, operationName) => {
    if (validationCache.has(entityName)) return validationCache.get(entityName);

    const entityFields = validatorsRegistry.get(entityName) || new Map();
    const shape = {};
    const requiredFields = new Set();
    const complexFields = new Set();

    for (const [fieldName, cfg] of entityFields) {
        const validator = typeof cfg.validator === 'function' ? cfg.validator() : cfg.validator;
        if (!validator) continue;
        shape[fieldName] = validator;
        if (cfg.required) requiredFields.add(fieldName);
        if (cfg.structuredErrors) complexFields.add(fieldName);
    }

    const schema = z.object(shape);
    const result = { schema, requiredFields, complexFields, validate: (data) => schema.safeParse(data) };
    validationCache.set(entityName, result);
    return result;
};

/**
 * Returns registry-derived default form values for an entity.
 * @param {string} entityName
 * @returns {Object}
 */
export const generateDefaultValues = (entityName) => {
    const entityFields = validatorsRegistry.get(entityName) || new Map();
    const defaults = {};
    for (const [fieldName, cfg] of entityFields) {
        defaults[fieldName] = cfg.defaultValue ?? '';
    }
    return defaults;
};

/**
 * Creates a TanStack Form field validator for a single field.
 * Fields with `structuredErrors: true` in their registry config also write
 * per-item error paths into `fieldApi.meta.structuredErrors` for complex inputs.
 * @param {string} fieldName
 * @param {{ schema: ZodObject, complexFields: Set }} validator
 * @param {*} _form - Form instance (reserved for future use)
 * @param {{ validateOnChange: boolean= }} options
 * @returns {Object} TanStack Form validator config
 */
export const createFieldValidator = (fieldName, validator, _form, options = {}) => {
    const { validateOnChange = false } = options;

    const validateField = ({ value, fieldApi }) => {
        const fieldSchema = validator.schema.shape?.[fieldName];
        if (!fieldSchema) return undefined;

        const result = fieldSchema.safeParse(value);

        if (!result.success) {
            if (validator.complexFields?.has(fieldName)) {
                const structured = result.error.errors.map(e => ({ ...e, path: [fieldName, ...e.path] }));
                fieldApi?.setMeta(prev => ({ ...prev, structuredErrors: structured }));
            }
            return result.error.errors.map(e => e.message).join(', ') || undefined;
        }

        if (validator.complexFields?.has(fieldName)) {
            fieldApi?.setMeta(prev => ({ ...prev, structuredErrors: [] }));
        }

        return undefined;
    };

    return {
        onSubmit: validateField,
        ...(validateOnChange && { onChange: validateField }),
    };
};

/**
 * Returns a TanStack Form `createForm` config for the given entity.
 * Caller-supplied options (including `defaultValues` and `onSubmit`) override the defaults.
 * @param {string} entityName
 * @param {string} operationName
 * @param {Object} options - Merged into the returned config (last-write-wins)
 * @returns {Object} TanStack Form config
 */
export const getFormConfig = (entityName, operationName, options = {}) => {
    const validator = getValidator(entityName, operationName);
    return {
        validators: { onChange: validator.schema },
        defaultValues: generateDefaultValues(entityName),
        onSubmit: () => {},
        ...options,
    };
};

// =============================================================================
// CUSTOM VALIDATORS REGISTRATION
// =============================================================================

registerCustomValidator('institutions', 'links', {
    structuredErrors: true,
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

// Name field validator for institutions - required field
registerCustomValidator('institutions', 'name', {
    validator: () => z.string().min(1, 'Institution name is required'),
    required: true,
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
    // Accept not provided or explicitly null (we don't want to send it from the form)
    validator: () => z.string().nullable().optional(),
    required: false,
    defaultValue: null
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

// Language validator - optional text field
registerCustomValidator('datasources', 'language', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: ''
});

// Contact validator - optional text field
registerCustomValidator('datasources', 'contact', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: ''
});

// Copyright validator - optional text field
registerCustomValidator('datasources', 'copyright', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: ''
});

// =============================================================================
// RESEARCH FIELDS VALIDATORS
// =============================================================================

// Field ID validator - hidden field for edit operations
registerCustomValidator('research_fields', 'fieldId', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: '',
    hidden: true
});

// Project ID validator - required field for research fields
registerCustomValidator('research_fields', 'projectId', {
    validator: () => z.string().min(1, 'Project ID is required'),
    required: true,
    defaultValue: ''
});

// Language ID validator - required field for text creation
registerCustomValidator('research_fields', 'languageId', {
    validator: () => z.string().min(1, 'Language is required'),
    required: true,
    defaultValue: ''
});

// Name (Title) validator - required field (not in schema; name_id is stored)
registerCustomValidator('research_fields', 'name', {
    validator: () => z.string().min(1, 'Title is required'),
    required: true,
    defaultValue: ''
});

// Type validator - required field for research field type
registerCustomValidator('research_fields', 'type', {
    validator: () => z.enum(['freetext', 'vocabulary'], {
        required_error: 'Field type is required',
        invalid_type_error: 'Field type must be either "freetext" or "vocabulary"'
    }),
    required: true,
    defaultValue: 'freetext'
});

// fieldsConfig is edited elsewhere (connection type detail); keep it hidden here
registerCustomValidator('research_fields', 'fieldsConfig', {
    validator: () => z.any().optional(),
    required: false,
    defaultValue: undefined,
    hidden: true
});



// Vocabularies validator - optional array of vocabulary options
registerCustomValidator('research_fields', 'vocabularies', {
    structuredErrors: true,
    validator: () => z.array(z.object({
        option: z.string().min(1, 'Option text is required'),
        description: z.string().optional(),
        mainAssetFile: z.any().optional(), // File object or null
        otherAssetsFiles: z.array(z.any()).optional(), // Array of File objects
        // Translation fields for secondary languages (dynamic based on available languages)
    }).catchall(z.string().optional())), // Allow additional translation fields
    required: false,
    defaultValue: []
});

// =============================================================================
// WEBSITE SETTINGS VALIDATORS
// =============================================================================

// Project ID validator - required field for website settings
registerCustomValidator('websiteSettings', 'projectId', {
    validator: () => z.string().min(1, 'Project ID is required'),
    required: true,
    defaultValue: ''
});

// Language ID validator - required field for text creation
registerCustomValidator('websiteSettings', 'languageId', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: ''
});

// Title validator - required field
registerCustomValidator('websiteSettings', 'title', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: ''
});

// About validator - optional field
registerCustomValidator('websiteSettings', 'about', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: ''
});

// Authors validator - optional field
registerCustomValidator('websiteSettings', 'authors', {
    validator: () => z.string().optional(),
    required: false,
    defaultValue: ''
});

// Subfolder path validator - optional field with path validation
registerCustomValidator('websiteSettings', 'subfolderPath', {
    validator: () => z.string().refine((val) => {
        // Allow empty strings, but if provided, must be valid path format
        const trimmedVal = val?.trim() || '';
        if (!trimmedVal) {
            return true; // Empty is allowed since field is optional
        }
        // Basic path validation - no spaces, special chars except hyphens and underscores
        const pathRegex = /^[a-zA-Z0-9\-_\/]*$/;
        return pathRegex.test(trimmedVal);
    }, 'Must be a valid path (letters, numbers, hyphens, underscores, and forward slashes only)'),
    required: false,
    defaultValue: ''
});

// Show unmapped validator - boolean field
registerCustomValidator('websiteSettings', 'showUnmapped', {
    validator: () => z.boolean().optional(),
    required: false,
    defaultValue: false
});

// Logo file validator - optional file upload
registerCustomValidator('websiteSettings', 'logoFile', {
    validator: () => z.any().optional(), // File object or null
    required: false,
    defaultValue: null
});

// Translation arrays for multilingual support
registerCustomValidator('websiteSettings', 'titleTranslations', {
    validator: () => z.array(z.object({
        languageId: z.string().min(1, 'Language ID is required'),
        content: z.string().min(1, 'Translation content is required')
    })).optional(),
    required: false,
    defaultValue: []
});

registerCustomValidator('websiteSettings', 'aboutTranslations', {
    validator: () => z.array(z.object({
        languageId: z.string().min(1, 'Language ID is required'),
        content: z.string().optional()
    })).optional(),
    required: false,
    defaultValue: []
});