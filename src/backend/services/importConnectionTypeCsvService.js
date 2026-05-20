/**
 * Connection-type CSV import service for restoring multilingual vocabulary
 * mappings into a project.
 *
 * @namespace backend.services.importConnectionTypeCsvService
 * @memberof backend.services
 */
import fsPromises from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as dbSchema from '../../db/schema.js';

async function createTextWithTranslations({ defaultLanguage, context, valuesByCode, languageIdsByCode }, db) {
  const baseContent = valuesByCode[defaultLanguage.code] || '';

  const [textRow] = await db.insert(dbSchema.texts).values({
    id: uuidv4(),
    content: baseContent,
    context,
    original_language_id: defaultLanguage.id
  }).returning();

  const translationRows = Object.entries(valuesByCode)
    .filter(([code, content]) => code !== defaultLanguage.code && String(content || '').trim())
    .map(([code, content]) => ({ code, content: String(content || '').trim() }));

  if (translationRows.length > 0) {
    const values = translationRows
      .map((translation) => {
        const languageId = languageIdsByCode.get(translation.code);
        if (!languageId) return null;
        return {
          id: uuidv4(),
          text_id: textRow.id,
          language_id: languageId,
          content: translation.content
        };
      })
      .filter(Boolean);

    if (values.length > 0) {
      await db.insert(dbSchema.translations).values(values).execute();
    }
  }

  return textRow;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMappingValue(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return normalizeMappingValue(value[0]);
  if (value && typeof value === 'object') {
    if (typeof value.value === 'string') return value.value.trim();
    if (typeof value.id === 'string') return value.id.trim();
  }
  return '';
}

function describeValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.map(describeValue).join(', ')}]`;
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

/**
 * Import a connection-type CSV file into a project.
 * @memberof backend.services.importConnectionTypeCsvService
 * @param {Object} options - Import options.
 * @param {Object} db - Database handle.
 * @returns {Promise<Object>}
 */
export async function importConnectionTypeCsv(options, { db }) {
  const { filePath, projectId, connectionTypeName, languageMapping = {} } = options || {};
  if (!filePath) throw new Error('filePath is required');
  if (!projectId) throw new Error('projectId is required');
  if (!normalizeString(connectionTypeName)) throw new Error('connectionTypeName is required');

  const projectLanguages = await db.select().from(dbSchema.languages).where(eq(dbSchema.languages.project_id, projectId)).execute();

  const defaultLanguage = projectLanguages.find((language) => language.is_default === 1) || projectLanguages[0];
  if (!defaultLanguage) {
    return { success: false, error: 'No project language found for import' };
  }

  const csvContent = await fsPromises.readFile(filePath, 'utf-8');
  let records;
  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true
    });
  } catch (error) {
    return { success: false, error: `Invalid CSV format for a connection type: ${error.message}` };
  }

  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: 'Invalid CSV format for a connection type.' };
  }

  const availableCodes = new Set(projectLanguages.map((language) => language.code));
  const headerColumns = Object.keys(records[0] || {});
  const optionColumns = headerColumns
    .filter((column) => column.startsWith('option_'))
    .map((column) => ({ column, code: column.slice('option_'.length) }));
  const descriptionColumns = headerColumns
    .filter((column) => column.startsWith('description_'))
    .map((column) => ({ column, code: column.slice('description_'.length) }));

  const allowedColumns = new Set([
    'connection_id',
    'external_link',
    ...optionColumns.map(({ column }) => column),
    ...descriptionColumns.map(({ column }) => column)
  ]);

  if (optionColumns.length === 0) {
    return { success: false, error: 'Invalid CSV format for a connection type.' };
  }

  const hasUnexpectedColumns = headerColumns.some((column) => !allowedColumns.has(column));
  if (hasUnexpectedColumns) {
    return { success: false, error: 'Invalid CSV format for a connection type.' };
  }

  const csvLanguageCodes = Array.from(new Set([
    ...optionColumns.map((column) => column.code),
    ...descriptionColumns.map((column) => column.code)
  ]));

  const resolvedLanguageMapping = new Map();
  for (const csvCode of csvLanguageCodes) {
    const rawMappedValue = languageMapping[csvCode];
    const mappedCode = normalizeMappingValue(languageMapping[csvCode]);
    if (mappedCode === '__skip__') {
      continue;
    }

    if (rawMappedValue === undefined && !availableCodes.has(csvCode)) {
      continue;
    }

    const effectiveCode = mappedCode || csvCode;
    if (!availableCodes.has(effectiveCode)) {
      return {
        success: false,
        error: `Invalid CSV language mapping for "${csvCode}": received "${describeValue(rawMappedValue)}", normalized to "${effectiveCode}". Project languages: ${Array.from(availableCodes).join(', ')}`
      };
    }
    resolvedLanguageMapping.set(csvCode, effectiveCode);
  }

  const targetCodes = Array.from(resolvedLanguageMapping.values());
  if (new Set(targetCodes).size !== targetCodes.length) {
    return { success: false, error: `Each CSV language must map to a different project language. Received mappings: ${JSON.stringify(Object.fromEntries(resolvedLanguageMapping))}` };
  }

  if (resolvedLanguageMapping.size === 0) {
    return { success: false, error: 'Select at least one CSV language to import.' };
  }

  const mappedOptionColumns = optionColumns.map((column) => ({
    ...column,
    targetCode: resolvedLanguageMapping.get(column.code)
  })).filter((column) => column.targetCode);
  const mappedDescriptionColumns = descriptionColumns.map((column) => ({
    ...column,
    targetCode: resolvedLanguageMapping.get(column.code)
  })).filter((column) => column.targetCode);

  const languageIdsByCode = new Map(projectLanguages.map((language) => [language.code, language.id]));

  const connectionTypeNameText = await createTextWithTranslations({
    defaultLanguage,
    context: 'research_fields.name',
    valuesByCode: { [defaultLanguage.code]: normalizeString(connectionTypeName) },
    languageIdsByCode
  }, db);

  const [newConnectionType] = await db.insert(dbSchema.research_fields).values({
    id: uuidv4(),
    name_id: connectionTypeNameText.id,
    description_id: null,
    type: 'vocabulary',
    project_id: projectId,
    private: 0,
    onwebsite: 1
  }).returning();

  let importedConnections = 0;

  for (const record of records) {
    const optionValues = Object.fromEntries(mappedOptionColumns.map(({ column, targetCode }) => [targetCode, normalizeString(record[column]) ]));
    const descriptionValues = Object.fromEntries(mappedDescriptionColumns.map(({ column, targetCode }) => [targetCode, normalizeString(record[column]) ]));

    const fallbackOption = optionValues[defaultLanguage.code] || Object.values(optionValues).find(Boolean) || '';
    if (!fallbackOption) continue;
    if (!optionValues[defaultLanguage.code]) optionValues[defaultLanguage.code] = fallbackOption;

    const optionText = await createTextWithTranslations({
      defaultLanguage,
      context: 'vocabularies.option',
      valuesByCode: optionValues,
      languageIdsByCode
    }, db);

    const descriptionText = await createTextWithTranslations({
      defaultLanguage,
      context: 'vocabularies.description',
      valuesByCode: descriptionValues,
      languageIdsByCode
    }, db);

    await db.insert(dbSchema.vocabularies).values({
      id: uuidv4(),
      option_id: optionText.id,
      description_id: descriptionText.id,
      external_link: normalizeString(record.external_link) || null,
      field_id: newConnectionType.id,
      main_asset_id: null
    }).execute();

    importedConnections += 1;
  }

  return {
    success: true,
    imported: {
      connection_types: 1,
      connections: importedConnections,
      images: 0
    }
  };
}