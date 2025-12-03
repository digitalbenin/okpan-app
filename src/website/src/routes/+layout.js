import { browser } from '$app/environment';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

// SSR enabled for static export so object detail pages can be prerendered
// Each page can override this (homepage sets ssr=false)
export const ssr = isStaticExport;
// Prerender is controlled at page level - layout doesn't force it
// Use trailing slash in static export to generate /id/index.html instead of id.html
export const trailingSlash = isStaticExport ? 'always' : 'ignore';

/** @type {import('./$types').LayoutLoad} */
export async function load({ url, fetch }) {
  // Static export mode: return nothing from layout
  // Homepage will load data.json client-side for search/filtering
  // Object detail pages will load data.json during prerendering only
  if (isStaticExport) {
    return {};
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