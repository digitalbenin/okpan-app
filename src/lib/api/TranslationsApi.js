import { executeQuery } from "$lib/api/graphqlClient.js";
import { invalidate } from "$app/navigation";

/**
 * @param {string} textId
 * @param {string} languageId
 * @param {string} content
 * @returns {Promise<Object>}
 */
export async function createTranslation({ textId, languageId, content }) {
    const result = await executeQuery('translations', 'create', { textId, languageId, content });
    await invalidate('app:translations');
    return result;
}

/**
 * @param {string} id
 * @param {string} content
 * @param {Object} [context]
 * @returns {Promise<Object>}
 */
export async function updateTranslation({ id, content, context }) {
    const result = await executeQuery('translations', 'update', { id, content }, context);
    await invalidate('app:translations');
    return result;
}

/**
 * @param {string} translationId
 * @returns {Promise<Object>}
 */
export async function deleteTranslation(translationId) {
    const result = await executeQuery('translations', 'delete', { translationId });
    await invalidate('app:translations');
    return result;
}

/**
 * @param {string} textId
 * @returns {Promise<Array>}
 */
export async function getTranslationsByTextId(textId) {
    return await executeQuery('translations', 'getByTextId', { textId });
}

/**
 * Pure helper to get existing translation ID from a field object's translations array.
 * @param {Object|null} fieldObj
 * @param {string} langCode
 * @returns {string|null}
 */
export function getExistingTranslationId(fieldObj, langCode) {
    return fieldObj?.translations?.find((t) => t.language?.code === langCode)?.id ?? null;
}

/**
 * Pure helper to get translation content from a field object's translations array.
 * @param {Object|null} fieldObj
 * @param {string} langCode
 * @returns {string}
 */
export function getTranslationContent(fieldObj, langCode) {
    return fieldObj?.translations?.find((t) => t.language?.code === langCode)?.content ?? "";
}

/**
 * Build default form values for translation fields.
 * @param {Object|null} entity
 * @param {Array} secondaryLanguages
 * @param {Array<string>} translatableFields
 * @returns {Object}
 */
export function buildTranslationFormValues(entity, secondaryLanguages, translatableFields) {
    const values = {};
    secondaryLanguages.forEach(lang => {
        translatableFields.forEach(fieldName => {
            values[`translations_${lang.id}_${fieldName}`] = getTranslationContent(entity?.[fieldName], lang.code);
        });
    });
    return values;
}

/**
 * Handle a single field translation — update existing or create new.
 * @param {Object|null} fieldObj
 * @param {string} langCode
 * @param {string} content
 * @param {Array} languages
 * @param {string|null} textId
 * @returns {Promise<Object|null>}
 */
export async function handleFieldTranslation(fieldObj, langCode, content, languages, textId = null) {
    const trimmed = content?.trim() ?? "";
    const existingId = getExistingTranslationId(fieldObj, langCode);
    const mainId = fieldObj?.id || textId;

    if (existingId) {
        return await updateTranslation({ id: existingId, content: trimmed });
    }

    if (mainId && trimmed) {
        const language = languages.find(lang => lang.code === langCode);
        if (!language) {
            throw new Error(`Language with code "${langCode}" not found`);
        }
        return await createTranslation({ textId: mainId, languageId: language.id, content: trimmed });
    }

    return null;
}

/**
 * Process all entity translations for secondary languages.
 * @param {Object|null} entity
 * @param {Array} secondaryLanguages
 * @param {Array<string>} translatableFields
 * @param {Object} formValues
 * @param {Array} languages
 * @param {Object|null} textIdMap
 * @returns {Promise<void>}
 */
export async function processEntityTranslations(entity, secondaryLanguages, translatableFields, formValues, languages, textIdMap = null) {
    const promises = secondaryLanguages.flatMap(lang =>
        translatableFields.map(fieldName => {
            const content = formValues[`translations_${lang.id}_${fieldName}`];
            return content !== undefined && content !== null
                ? handleFieldTranslation(entity?.[fieldName], lang.code, content, languages, textIdMap?.[fieldName])
                : null;
        })
    ).filter(Boolean);

    if (promises.length > 0) await Promise.all(promises);
}
