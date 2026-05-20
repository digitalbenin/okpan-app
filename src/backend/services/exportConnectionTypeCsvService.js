/**
 * Connection-type CSV export service for serializing multilingual vocabulary
 * mappings from a project.
 *
 * @namespace backend.services.exportConnectionTypeCsvService
 * @memberof backend.services
 */
import fsPromises from 'fs/promises';
import { eq, and, inArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (!stringValue) return '';
  return `"${stringValue.replace(/"/g, '""')}"`;
};

async function writeCsv(filePath, header, rows) {
  const lines = [header.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  await fsPromises.writeFile(filePath, lines.join('\n'), 'utf-8');
}

function indexBy(rows, key = 'id') {
  return new Map(rows.map((row) => [row?.[key], row]));
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const groupKey = row?.[key];
    if (!groupKey) return acc;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(row);
    return acc;
  }, {});
}

function getTextMap(textRow, translations, languagesById) {
  if (!textRow) return {};

  const map = {};
  const originalLanguage = languagesById.get(textRow.original_language_id);
  if (originalLanguage?.code) {
    map[originalLanguage.code] = textRow.content || '';
  }

  for (const translation of translations || []) {
    const language = languagesById.get(translation.language_id);
    if (language?.code) {
      map[language.code] = translation.content || '';
    }
  }

  return map;
}

/**
 * Export a single connection type to CSV.
 * @memberof backend.services.exportConnectionTypeCsvService
 * @param {Object} options - Export options.
 * @param {Object} db - Database handle.
 * @returns {Promise<Object>}
 */
export async function exportConnectionTypeCsv(options, { db }) {
  const { filePath, projectId, connectionTypeId } = options || {};
  if (!filePath || !filePath.toLowerCase().endsWith('.csv')) throw new Error('filePath must be a .csv path for connection type export');
  if (!projectId) throw new Error('projectId is required');
  if (!connectionTypeId) throw new Error('connectionTypeId is required');

  const [connectionType] = await db
    .select()
    .from(dbSchema.research_fields)
    .where(and(
      eq(dbSchema.research_fields.id, connectionTypeId),
      eq(dbSchema.research_fields.project_id, projectId)
    ))
    .execute();

  if (!connectionType || String(connectionType.type || '').toLowerCase() !== 'vocabulary') {
    throw new Error('Connection type not found');
  }

  const [languages, vocabularies] = await Promise.all([
    db.select().from(dbSchema.languages).where(eq(dbSchema.languages.project_id, projectId)).execute(),
    db.select().from(dbSchema.vocabularies).where(eq(dbSchema.vocabularies.field_id, connectionTypeId)).execute()
  ]);

  const orderedLanguages = [...languages].sort((a, b) => {
    if (a.is_default === b.is_default) return String(a.code || '').localeCompare(String(b.code || ''));
    return a.is_default === 1 ? -1 : 1;
  });

  const textIds = Array.from(new Set(vocabularies.flatMap((vocabulary) => [
    vocabulary.option_id,
    vocabulary.description_id
  ].filter(Boolean))));

  const [texts, translations] = await Promise.all([
    textIds.length
      ? db.select().from(dbSchema.texts).where(inArray(dbSchema.texts.id, textIds)).execute()
      : [],
    textIds.length && orderedLanguages.length
      ? db.select().from(dbSchema.translations).where(and(
        inArray(dbSchema.translations.text_id, textIds),
        inArray(dbSchema.translations.language_id, orderedLanguages.map((language) => language.id))
      )).execute()
      : []
  ]);

  const textsById = indexBy(texts);
  const translationsByTextId = groupBy(translations, 'text_id');
  const languagesById = indexBy(orderedLanguages);

  const header = [
    'connection_id',
    'external_link',
    ...orderedLanguages.map((language) => `option_${language.code}`),
    ...orderedLanguages.map((language) => `description_${language.code}`)
  ];

  const rows = vocabularies.map((vocabulary) => {
    const optionMap = getTextMap(
      textsById.get(vocabulary.option_id),
      translationsByTextId[vocabulary.option_id],
      languagesById
    );
    const descriptionMap = getTextMap(
      textsById.get(vocabulary.description_id),
      translationsByTextId[vocabulary.description_id],
      languagesById
    );

    return [
      vocabulary.id,
      vocabulary.external_link || '',
      ...orderedLanguages.map((language) => optionMap[language.code] || ''),
      ...orderedLanguages.map((language) => descriptionMap[language.code] || '')
    ];
  });

  await writeCsv(filePath, header, rows);

  return {
    filePath,
    mode: 'csv',
    counts: {
      connection_types: 1,
      connections: vocabularies.length,
      images: 0
    }
  };
}