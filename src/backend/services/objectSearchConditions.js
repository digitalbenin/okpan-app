import { sql, eq, inArray, and, or } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';

export function buildObjectSearchConditions(args) {
  const { project_id, institutionIds, status, ontologyQuery, ontologyFieldIds, researchFieldFilters } = args || {};
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
  return conditions;
}
