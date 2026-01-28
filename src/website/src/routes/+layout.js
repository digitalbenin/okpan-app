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
  // Static export mode: read site.json for project/settings (sidebar data)
  // Use fs.readFileSync to avoid SvelteKit embedding the full data.json
  if (isStaticExport) {
    // During prerendering (server-side), read from filesystem
    if (!browser) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const siteJsonPath = path.join(process.cwd(), 'static', 'site.json');
        const content = fs.readFileSync(siteJsonPath, 'utf-8');
        const siteData = JSON.parse(content);
        return { 
          project: siteData.project || {},
          settings: siteData.settings || {},
          connection_types: siteData.connection_types || [],
          needsClientLoad: false // Already have the data
        };
      } catch (e) {
        console.warn('[layout] Could not read site.json during prerender:', e.message);
        return { needsClientLoad: true };
      }
    }
    // Client-side in static export: fetch site.json
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
  
  const projectId = url.searchParams.get('project_id');

  const institutions = fetchInstitutions(db, projectId);
  const ontology_fields = fetchOntologyFields(db, projectId);
  const research_fields = fetchResearchFields(db, projectId);
  const vocabularies = fetchVocabularies(db, projectId);
  const project = fetchProject(db, projectId);
  const settings = fetchWebsiteSettings(db, projectId);
  const connection_types = (research_fields || [])
    .filter((field) => field?.type === 'vocabulary')
    .map((field) => ({ id: field.id, name: field.name, description: field.description }));

  return {
    institutions,
    ontology_fields,
    research_fields,
    vocabularies,
    project,
    settings,
    connection_types
  };
}