import { z } from "zod";

export const METADATA_FIELDS = ["description", "copyright", "author"];

function createMetadataSchema() {
  return z.object({
    description: z.string().optional(),
    copyright: z.string().optional(),
    author: z.string().optional(),
  });
}

/**
 * Creates the validator shape used by asset metadata forms.
 * @returns {{schema: object, requiredFields: Set<string>, validate: Function}}
 */
export function createMetadataValidator() {
  const schema = createMetadataSchema();
  return {
    schema,
    requiredFields: new Set([]),
    validate: (data) => schema.safeParse(data),
  };
}

/**
 * Builds a language-keyed metadata payload from AutoForm values.
 * @param {Record<string, string>} value Form values containing base and translations_* fields.
 * @param {Array<{id: string, code: string, is_default: (boolean|undefined)}>} languages Available project languages.
 * @param {{code: (string|undefined)}|null|undefined} defaultLanguage Default language descriptor.
 * @returns {{description: Record<string, string>, copyright: Record<string, string>, author: Record<string, string>}}
 */
export function buildTranslationsFromValue(value, languages, defaultLanguage) {
  const translations = Object.fromEntries(
    METADATA_FIELDS.map((field) => [field, {}])
  );
  const defaultCode = defaultLanguage?.code;
  if (defaultCode) {
    METADATA_FIELDS.forEach((field) => {
      const content = value[field]?.trim();
      if (content) {
        translations[field][defaultCode] = content;
      }
    });
  }

  for (const lang of languages.filter((l) => !l.is_default)) {
    for (const field of METADATA_FIELDS) {
      const key = `translations_${lang.id}_${field}`;
      const content = value[key]?.trim();
      if (content) {
        translations[field][lang.code] = content;
      }
    }
  }

  return translations;
}

/**
 * Merges translated metadata into an asset properties payload.
 * @param {string|Record<string, Record<string, string>>|null|undefined} existingProps Existing asset properties.
 * @param {{description: (Record<string, string>|undefined), copyright: (Record<string, string>|undefined), author: (Record<string, string>|undefined)}} newTranslations New metadata translations to merge.
 * @returns {string} JSON string ready to persist in the asset properties field.
 */
export function mergeTranslations(existingProps, newTranslations) {
  const existing = typeof existingProps === "string"
    ? (() => { try { return JSON.parse(existingProps); } catch { return {}; } })()
    : (existingProps || {});

  const merged = Object.fromEntries(
    METADATA_FIELDS.map((field) => [field, { ...(existing[field] || {}) }])
  );

  for (const key of METADATA_FIELDS) {
    if (newTranslations[key]) {
      for (const [langCode, content] of Object.entries(newTranslations[key])) {
        if (typeof content === "string" && content.trim() !== "") {
          merged[key][langCode] = content;
        }
      }
    }
  }

  return JSON.stringify(merged);
}

export function parseMetadata(properties) {
  if (!properties) return {};
  if (typeof properties === "object") return properties;
  try { return JSON.parse(properties); } catch { return {}; }
}

export function buildMetadataFormValues(metadata, defaultLanguageCode, secondaryLanguages) {
  const values = {};
  METADATA_FIELDS.forEach(field => {
    values[field] = metadata?.[field]?.[defaultLanguageCode] || "";
  });
  secondaryLanguages.forEach(lang => {
    METADATA_FIELDS.forEach(field => {
      values[`translations_${lang.id}_${field}`] = metadata?.[field]?.[lang.code] || "";
    });
  });
  return values;
}