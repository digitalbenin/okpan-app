import { browser } from '$app/environment';
import { getDb } from '$lib/utils/dbUtils.js';

function results_to_objects(res) {
  if (!res || res.length === 0) return [];
  const cols = res[0].columns;
  const values = res[0].values;
  return values.map((row) => {
    const o = {};
    for (let i = 0; i < cols.length; i++) o[cols[i]] = row[i];
    return o;
  });
}

/** @type {import('./$types').LayoutLoad} */
export async function load({ url }) {
  if (!browser) {
    // This load function runs on the server during SSR, but our DB is client-only.
    // Return empty data and let the client-side load handle it after hydration.
    return;
  }

  const db = await getDb();
  const projectId = url.searchParams.get('project_id');

  let institutions_res;
  if (projectId) {
    institutions_res = db.exec(
      'SELECT i.*, t.content as name FROM institutions i LEFT JOIN texts t ON i.name_id = t.id WHERE i.project_id = ?',
      [projectId]
    );
  } else {
    institutions_res = db.exec(
      'SELECT i.*, t.content as name FROM institutions i LEFT JOIN texts t ON i.name_id = t.id'
    );
  }

  let ontology_fields_res;
  if (projectId) {
    ontology_fields_res = db.exec(
      'SELECT o.*, t.content as name FROM ontology_fields o LEFT JOIN texts t ON o.name_id = t.id WHERE o.project_id = ?',
      [projectId]
    );
  } else {
    ontology_fields_res = db.exec(
      'SELECT o.*, t.content as name FROM ontology_fields o LEFT JOIN texts t ON o.name_id = t.id'
    );
  }

  let research_fields_res;
  if (projectId) {
    research_fields_res = db.exec(
      'SELECT r.*, t.content as name FROM research_fields r LEFT JOIN texts t ON r.name_id = t.id WHERE r.project_id = ?',
      [projectId]
    );
  } else {
    research_fields_res = db.exec(
      'SELECT r.*, t.content as name FROM research_fields r LEFT JOIN texts t ON r.name_id = t.id'
    );
  }

  let vocabularies_res;
  if (projectId) {
    vocabularies_res = db.exec(
      `
      SELECT v.*, t.content as name, ga.path as main_asset_path
      FROM vocabularies v
      JOIN research_fields rf ON v.field_id = rf.id
      LEFT JOIN texts t ON v.option_id = t.id
      LEFT JOIN generic_assets ga ON v.main_asset_id = ga.id
      WHERE rf.project_id = ?
    `,
      [projectId]
    );
  } else {
    vocabularies_res = db.exec(
      'SELECT v.*, t.content as name, ga.path as main_asset_path FROM vocabularies v LEFT JOIN texts t ON v.option_id = t.id LEFT JOIN generic_assets ga ON v.main_asset_id = ga.id'
    );
  }

  let projects_res;
  if (projectId) {
    projects_res = db.exec(
      `
      SELECT p.*,
             title_text.content as name,
             desc_text.content as description
      FROM project p
      LEFT JOIN texts title_text ON p.title_id = title_text.id
      LEFT JOIN texts desc_text ON p.description_id = desc_text.id
      WHERE p.id = ?
      `,
      [projectId]
    );
  }

  return {
    institutions: results_to_objects(institutions_res),
    ontology_fields: results_to_objects(ontology_fields_res),
    research_fields: results_to_objects(research_fields_res),
    vocabularies: results_to_objects(vocabularies_res),
    project: projects_res ? results_to_objects(projects_res)[0] : {}
  };
}