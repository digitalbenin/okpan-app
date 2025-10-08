import { browser } from '$app/environment';
import { getDb, getResults, parseJsonFields } from '$lib/utils/dbUtils.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, url }) {
    // Do not run client-DB queries on the server
    if (!browser) {
        return { object: null, assets: [], ontologyFields: [], researchFields: [], datasources: [], queryParams: { projectId: url.searchParams.get('project_id') } };
    }

    const db = await getDb();
    if (!db) {
        throw new Error('Client DB not initialized. Make sure it is initialized in the root layout before using this page loader.');
    }

    const objId = params.objId;
    const projectId = url.searchParams.get('project_id');

    // Subqueries with minimal joins to avoid duplicating data already available from +layout.js
    // (We only return IDs needed to reconcile with global lists in +layout.js.)
    const subqueries = {
        assets: `(
      SELECT json_group_array(json_object(
        'order', oa."order",
        'asset_id', oa.asset_id,
        'asset_filename', a.filename,
        'asset_path', a.path,
        'asset_type', a.type,
        'asset_formats', a.formats,
        'asset_properties', a.properties
      ))
      FROM objects_assets oa
      JOIN assets a ON oa.asset_id = a.id
      WHERE oa.object_id = o.id
    )`,
        // Do NOT join ontology_fields/texts here; the page can reconcile by field_id using data from +layout.js
        ontology: `(
      SELECT json_group_array(json_object(
        'id', oof.id,
        'label', oof.label,
        'value', oof.value,
        'field_id', oof.field_id,
        'datasources_id', oof.datasources_id,
        'primary', oof."primary"
      ))
      FROM objects_ontology_fields oof
      WHERE oof.object_id = o.id
    )`,
        // Do NOT join research_fields/vocabularies here; reconcile by ids from +layout.js
        research: `(
      SELECT json_group_array(json_object(
        'id', orf.id,
        'value', orf.value,
        'field_id', orf.field_id,
        'vocabulary_id', orf.vocabulary_id
      ))
      FROM objects_research_fields orf
      WHERE orf.object_id = o.id
    )`,
        // Keep datasource details here (no global datasource list is loaded in +layout.js)
        datasources: `(
      SELECT json_group_array(json_object(
        'id', ds.id,
        'name', ds_name.content,
        'method', ds_method.content,
        'notes', ds_notes.content,
        'language', ds.language,
        'copyright', ds.copyright,
        'date', ds.date,
        'institution_id', ds.institution_id,
        'institution_name', inst_name_ds.content
      ))
      FROM datasources ds
      LEFT JOIN texts ds_name ON ds.name_id = ds_name.id
      LEFT JOIN texts ds_method ON ds.method_id = ds_method.id
      LEFT JOIN texts ds_notes ON ds.notes_id = ds_notes.id
      LEFT JOIN institutions inst_ds ON ds.institution_id = inst_ds.id
      LEFT JOIN texts inst_name_ds ON inst_ds.name_id = inst_name_ds.id
      WHERE ds.id IN (
        SELECT DISTINCT oof.datasources_id
        FROM objects_ontology_fields oof
        WHERE oof.object_id = o.id AND oof.datasources_id IS NOT NULL
      )
    )`
    };

    const sql = `
    SELECT
      o.id, o.created_at, o.updated_at, o.status, o.institution_id, o.project_id,
      ${subqueries.assets} AS objects_assets_json,
      ${subqueries.ontology} AS objects_ontology_fields_json,
      ${subqueries.research} AS objects_research_fields_json,
      ${subqueries.datasources} AS datasources_json
    FROM objects o
    WHERE o.id = ?
    LIMIT 1
  `;

    const stmt = db.prepare(sql);
    stmt.bind([objId]);
    let items = getResults(stmt);
    items = parseJsonFields(items);

    const row = items[0] || null;

    // Normalize arrays and shape return payload for the page
    const toArray = (v) => (Array.isArray(v) ? v : v ? v : []);
    const assets = toArray(row?.objects_assets_json).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const objectOntologyFields = toArray(row?.objects_ontology_fields_json);
    const objectResearchFields = toArray(row?.objects_research_fields_json);
    const datasources = toArray(row?.datasources_json);

    const object = row
        ? {
            id: row.id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            status: row.status,
            institution_id: row.institution_id,
            project_id: row.project_id
        }
        : null;

    return {
        queryParams: { projectId },
        object,
        assets,
        objectOntologyFields,
        objectResearchFields,
        datasources
    };
}