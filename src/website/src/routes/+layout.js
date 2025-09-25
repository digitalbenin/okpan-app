import { browser } from '$app/environment';
import { getDb, fetchInstitutions, fetchOntologyFields, fetchResearchFields, fetchVocabularies, fetchProject } from '$lib/utils/dbUtils.js';

/** @type {import('./$types').LayoutLoad} */
export async function load({ url }) {
  if (!browser) {
    // Client-only DB: during SSR return nothing and let client hydrate.
    return;
  }

  const db = await getDb();
  const projectId = url.searchParams.get('project_id');

  const institutions = fetchInstitutions(db, projectId);
  const ontology_fields = fetchOntologyFields(db, projectId);
  const research_fields = fetchResearchFields(db, projectId);
  const vocabularies = fetchVocabularies(db, projectId);
  const project = fetchProject(db, projectId);

  return {
    institutions,
    ontology_fields,
    research_fields,
    vocabularies,
    project
  };
}