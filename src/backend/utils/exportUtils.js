/**
 * Shared helpers for backend export flows and export-related query building.
 *
 * @namespace backend.utils.exportUtils
 * @memberof backend.utils
 */
import { sql, eq, inArray, and, or, notInArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';

/**
 * Sanitize a user-visible filename for filesystem-safe export output.
 * @memberof backend.utils.exportUtils
 * @param {string} value - Proposed filename.
 * @param {string} [fallback='export'] - Fallback value when the input is empty.
 * @returns {string}
 */
export function sanitizeFilename(value, fallback = 'export') {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '');

  return normalized || fallback;
}

/**
 * Build item counts for export result payloads.
 * @memberof backend.utils.exportUtils
 * @param {Object} [options={}] - Count sources.
 * @param {Object[]} [options.objects=[]] - Exported objects.
 * @param {Object[]} [options.assets=[]] - Exported assets.
 * @param {Object[]} [options.institutions=[]] - Exported institutions.
 * @returns {{objects:number, assets:number, institutions:number}}
 */
export function buildCounts({
  objects = [],
  assets = [],
  institutions = [],
} = {}) {
  return {
    objects: objects.length,
    assets: assets.length,
    institutions: institutions.length,
  };
}

/**
 * Create the standard export response returned by export handlers/services.
 * @memberof backend.utils.exportUtils
 * @param {Object} options - Export result fields.
 * @param {string} options.filePath - Written file path.
 * @param {boolean} options.zipped - Whether the export was archived.
 * @param {Object} options.counts - Exported entity counts.
 * @param {string} options.fallbackMode - Non-zip mode label.
 * @returns {{filePath:string, mode:string, counts:Object}}
 */
export function makeExportResult({ filePath, zipped, counts, fallbackMode }) {
  return { filePath, mode: zipped ? 'zip' : fallbackMode, counts };
}

/**
 * Build Drizzle conditions for project object export queries.
 * @memberof backend.utils.exportUtils
 * @param {Object} args - Search filters.
 * @param {string} args.project_id - Project identifier.
 * @param {string[]} [args.institutionIds] - Institution ids to include.
 * @param {string} [args.status] - Object status filter.
 * @param {string} [args.ontologyQuery] - Free-text ontology filter.
 * @param {string[]} [args.ontologyFieldIds] - Ontology fields to search.
 * @param {Array<Object|string>} [args.researchFieldFilters] - Research field filters.
 * @param {string[]} [args.excludeObjectIds] - Object ids to exclude.
 * @returns {Array}
 */
export function buildObjectSearchConditions(args) {
  const { project_id, institutionIds, status, ontologyQuery, ontologyFieldIds, researchFieldFilters, excludeObjectIds } = args || {};
  const conditions = [eq(dbSchema.objects.project_id, project_id)];
  if (institutionIds && institutionIds.length > 0) conditions.push(inArray(dbSchema.objects.institution_id, institutionIds));
  if (status) conditions.push(eq(dbSchema.objects.status, status));
  if (ontologyQuery && ontologyQuery.trim()) {
    const q = `%${ontologyQuery.trim().toLowerCase()}%`;
    if (ontologyFieldIds && ontologyFieldIds.length > 0) {
      const existsPerField = ontologyFieldIds.map((fid) => sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_ontology_fields} oof WHERE oof.object_id = ${dbSchema.objects.id} AND oof.field_id = ${fid} AND LOWER(oof.value) LIKE ${q})`);
      conditions.push(existsPerField.length === 1 ? existsPerField[0] : or(...existsPerField));
    } else {
      conditions.push(sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_ontology_fields} oof WHERE oof.object_id = ${dbSchema.objects.id} AND LOWER(oof.value) LIKE ${q})`);
    }
  }

  const rfFilters = Array.isArray(researchFieldFilters)
    ? researchFieldFilters.map((f) => { try { return typeof f === 'string' ? JSON.parse(f) : f; } catch { return f; } })
    : [];
  if (rfFilters.length > 0) {
    const rfConds = [];
    for (const filter of rfFilters) {
      const fieldConds = [];
      if (filter?.query && String(filter.query).trim()) {
        const rq = `%${String(filter.query).trim().toLowerCase()}%`;
        fieldConds.push(sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_research_fields} orf WHERE orf.object_id = ${dbSchema.objects.id} AND orf.field_id = ${filter.fieldId} AND LOWER(orf.value) LIKE ${rq})`);
      }
      if (filter?.vocabularyIds && filter.vocabularyIds.length > 0) {
        const vocOr = filter.vocabularyIds.map((vid) => sql`EXISTS (SELECT 1 FROM ${dbSchema.objects_research_fields} orf WHERE orf.object_id = ${dbSchema.objects.id} AND orf.field_id = ${filter.fieldId} AND orf.vocabulary_id = ${vid})`);
        fieldConds.push(vocOr.length === 1 ? vocOr[0] : or(...vocOr));
      }
      if (fieldConds.length > 0) rfConds.push(fieldConds.length === 1 ? fieldConds[0] : and(...fieldConds));
    }
    if (rfConds.length > 0) conditions.push(rfConds.length === 1 ? rfConds[0] : and(...rfConds));
  }

  // Exclude specific object IDs if provided
  if (excludeObjectIds && excludeObjectIds.length > 0) {
    const ex = excludeObjectIds.filter(Boolean);
    if (ex.length > 0) conditions.push(notInArray(dbSchema.objects.id, ex));
  }
  return conditions;
}
