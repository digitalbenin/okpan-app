import { z } from "zod";

export function createMetadataSchema() {
  return z.object({
    description: z.string().optional(),
    copyright: z.string().optional(),
    author: z.string().optional(),
  });
}

export function createMetadataValidator() {
  const schema = createMetadataSchema();
  return {
    schema,
    requiredFields: new Set([]),
    validate: (data) => schema.safeParse(data),
  };
}

export function buildTranslationsFromValue(value, languages, defaultLanguage) {
  const translations = { description: {}, copyright: {}, author: {} };
  const defaultCode = defaultLanguage?.code;
  if (defaultCode) {
    if (value.description?.trim()) translations.description[defaultCode] = value.description;
    if (value.copyright?.trim()) translations.copyright[defaultCode] = value.copyright;
    if (value.author?.trim()) translations.author[defaultCode] = value.author;
  }

  for (const lang of languages.filter((l) => !l.is_default)) {
    for (const field of ["description", "copyright", "author"]) {
      const key = `translations_${lang.id}_${field}`;
      if (value[key]?.trim()) {
        translations[field][lang.code] = value[key];
      }
    }
  }

  return translations;
}

export function mergeTranslations(existingProps, newTranslations) {
  const existing = typeof existingProps === "string"
    ? (() => { try { return JSON.parse(existingProps); } catch { return {}; } })()
    : (existingProps || {});

  const merged = {
    description: { ...(existing.description || {}) },
    copyright: { ...(existing.copyright || {}) },
    author: { ...(existing.author || {}) },
  };

  for (const key of ["description", "copyright", "author"]) {
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