import { browser } from '$app/environment';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

export const ssr = false;
export const prerender = isStaticExport;
// Use trailing slash in static export to generate /id/index.html instead of id.html
// This works better with most static file servers
export const trailingSlash = isStaticExport ? 'always' : 'ignore';

/** @type {import('./$types').LayoutLoad} */
export async function load({ url, fetch }) {
  // Static export mode: load from data.json
  if (isStaticExport) {
    const response = await fetch('/data.json');
    if (!response.ok) {
      throw new Error(`Failed to load data.json: ${response.statusText}`);
    }
    const data = await response.json();
    return {
      objects: data.objects || [],
      institutions: data.institutions || [],
      ontology_fields: data.ontology_fields || [],
      research_fields: data.research_fields || [],
      vocabularies: data.vocabularies || [],
      project: data.project || {},
      settings: data.settings || {}
    };
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
  
  const projectId = url.searchParams.get('project_id');

  const institutions = fetchInstitutions(db, projectId);
  const ontology_fields = fetchOntologyFields(db, projectId);
  const research_fields = fetchResearchFields(db, projectId);
  const vocabularies = fetchVocabularies(db, projectId);
  const project = fetchProject(db, projectId);
  const settings = fetchWebsiteSettings(db, projectId);

  return {
    institutions,
    ontology_fields,
    research_fields,
    vocabularies,
    project,
    settings
  };
}