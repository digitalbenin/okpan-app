import { db } from '../../db/init.js';
import { change_log, ingestion_state, project } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

// Central FK order used for SQLite-safe insert/update/delete sequences
export const FK_ORDER = [
  'project',
  'languages',
  'texts',
  'translations',
  'institutions',
  'objects',
  'templates',
  'datasources',
  'imports',
  'ontology_fields',
  'research_fields',
  'assets',
  'generic_assets',
  'vocabularies',
  'vocabularies_generic_assets',
  'objects_assets',
  'assets_institutions',
  'objects_research_fields',
  'objects_ontology_fields',
  'object_display_fields',
  'settings',
  'website_settings'
];

// Snapshot manifest for a project closure, including counts and sync watermarks
export async function getProjectSnapshotManifest(projectId) {
  if (!projectId) throw new Error('getProjectSnapshotManifest requires projectId');

  // Watermark: prefer ingestion_state.last_processed_change_id, fallback to last change_log by rowid
  const stateRows = await db
    .select({ last_id: ingestion_state.last_processed_change_id })
    .from(ingestion_state)
    .where(eq(ingestion_state.project_id, projectId))
    .limit(1)
    .execute();

  let watermarkId = stateRows?.[0]?.last_id ?? null;
  if (!watermarkId) {
    const lastChange = await db
      .select({ id: change_log.id, rowid: sql`rowid` })
      .from(change_log)
      .where(eq(change_log.project_id, projectId))
      .orderBy(sql`rowid desc`)
      .limit(1)
      .execute();
    watermarkId = lastChange?.[0]?.id ?? null;
  }

  // Project created version: used for compatibility warnings
  const projRows = await db
    .select({ createdAppVersion: project.created_app_version })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1)
    .execute();
  const createdAppVersion = projRows?.[0]?.createdAppVersion ?? null;

  return {
    projectId,
    watermarkId,
    createdAppVersion
  };
}