import { browser } from '$app/environment';
import { resolveProjectId } from '$lib/utils/projectContext.js';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

// SSR enabled for static export so object detail pages can be prerendered
// Each page can override this (homepage sets ssr=false)
export const ssr = isStaticExport;
// Normalize URLs for SPA exports and preview.
export const trailingSlash = 'ignore';

/** @type {import('./$types').LayoutLoad} */
export async function load({ url, fetch }) {
  // Static export mode: always load site data client-side from site.json.
  if (isStaticExport) {
    return { needsClientLoad: true };
  }

  // Preview mode: use database
  if (!browser) {
    // Client-only DB: during SSR return nothing and let client hydrate.
    return;
  }

  const { getDb, initClientDb, fetchInstitutions, fetchOntologyFields, fetchResearchFields, fetchVocabularies, fetchProject, fetchWebsiteSettings } = await import('$lib/utils/dbUtils.js');
  
  // Ensure DB is initialized (may have been done in hooks.client.js, but be safe)
  let db = getDb();
  if (!db) {
    await initClientDb();
    db = getDb();
  }
  // getDb returns a promise, so await it
  db = await db;
  
  const projectId = resolveProjectId(url);

  const institutions = fetchInstitutions(db, projectId);
  const ontology_fields = fetchOntologyFields(db, projectId);
  const research_fields = fetchResearchFields(db, projectId);
  const vocabularies = fetchVocabularies(db, projectId);
  const project = fetchProject(db, projectId);
  const settings = fetchWebsiteSettings(db, projectId);
  const connection_types = (research_fields || [])
    .filter((field) => field?.type === 'vocabulary')
    .map((field) => ({
      id: field.id,
      name: field.name,
      description: field.description,
      count: (vocabularies || []).filter(v => v.field_id === field.id).length
    }));

  return {
    institutions,
    ontology_fields,
    research_fields,
    vocabularies,
    project,
    settings,
    activeProjectId: projectId,
    connection_types
  };
}