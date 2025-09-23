import { browser } from '$app/environment';
import { getDb } from '$lib/utils/dbUtils.js';

function results_to_objects(res) {
  if (!res || res.length === 0) return [];
  const cols = res[0].columns;
  const values = res[0].values;
  return values.map(row => {
    const o = {};
    for (let i = 0; i < cols.length; i++) o[cols[i]] = row[i];
    return o;
  });
}

/** @type {import('./$types').LayoutLoad} */
export async function load() {
  if (!browser) {
    // This load function runs on the server during SSR, but our DB is client-only.
    // Return empty data and let the client-side load handle it after hydration.
    return;
  }

  const db = await getDb();

  // Preload global lookups for SPA usage
  const institutions_res = db.exec('SELECT * FROM institutions');
  const ontology_fields_res = db.exec('SELECT * FROM ontology_fields');
  const research_fields_res = db.exec('SELECT * FROM research_fields');

  return {
    institutions: results_to_objects(institutions_res),
    ontology_fields: results_to_objects(ontology_fields_res),
    research_fields: results_to_objects(research_fields_res)
  };
}