import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let dbPromise = null;

/**
 * Initialize the client-side sql.js database from a static asset.
 * Subsequent calls return the same promise.
 * @param {string} dbUrl path to the DB file (default: 'media://db/local.db')
 * @returns {Promise<import('sql.js').Database>}
 */
export function initClientDb(dbUrl = 'media://src/db/local.db') {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const res = await fetch(dbUrl);
    if (!res.ok) throw new Error(`Failed to fetch DB from ${dbUrl}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const db = new SQL.Database(bytes);
    return db;
  })();

  return dbPromise;
}

/**
 * Get the database promise if initialized; otherwise null.
 * @returns {Promise<import('sql.js').Database> | null}
 */
export function getDb() {
  return dbPromise;
}

/**
 * Executes a prepared statement and returns all results, ensuring the statement is freed.
 * Converts BigInt values to Numbers for compatibility with JavaScript operators.
 * @param {import('sql.js').Statement} stmt
 * @returns {Object[]}
 */
export function getResults(stmt) {
  try {
    const results = [];
    let rowIndex = 0;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      // Log first row to debug types
      if (rowIndex === 0) {
        console.log('[getResults] First row raw:', JSON.stringify(row, (k, v) => typeof v === 'bigint' ? `BigInt(${v})` : v));
        for (const key in row) {
          console.log(`[getResults] Field "${key}": value=${row[key]}, typeof=${typeof row[key]}`);
        }
      }
      // Convert BigInt values to Numbers (sql.js returns BigInt for COUNT, etc.)
      for (const key in row) {
        if (typeof row[key] === 'bigint') {
          console.log(`[getResults] Converting BigInt field "${key}": ${row[key]} -> ${Number(row[key])}`);
          row[key] = Number(row[key]);
        }
      }
      results.push(row);
      rowIndex++;
    }
    return results;
  } finally {
    stmt.free();
  }
}

/**
 * Parses JSON string fields in query results into objects.
 * @param {Object[]} items
 * @returns {Object[]}
 */
export function parseJsonFields(items) {
  return items.map((item) => {
    const newItem = { ...item };
    for (const key in newItem) {
      if (key.endsWith('_json') && typeof newItem[key] === 'string') {
        try {
          newItem[key] = JSON.parse(newItem[key]);
        } catch (e) {
          // console.error(`Failed to parse JSON for key ${key}:`, e);
          newItem[key] = []; // Default to empty array on parse error
        }
      }
    }
    return newItem;
  });
}

/**
 * A utility to rebuild a parameter array for a faceted query,
 * excluding parameters associated with a specific filter.
 * @param {string[]} clauses - The original WHERE clauses.
 * @param {any[]} originalParams - The original parameters.
 * @param {string} filterIdentifier - A string to identify clauses to exclude.
 * @returns {any[]}
 */
export function getParamsWithout(clauses, originalParams, filterIdentifier) {
  let paramIndex = 0;
  const newParams = [];
  for (const clause of clauses) {
    const paramCount = (clause.match(/\?/g) || []).length;
    if (!clause.includes(filterIdentifier)) {
      newParams.push(...originalParams.slice(paramIndex, paramIndex + paramCount));
    }
    paramIndex += paramCount;
  }
  return newParams;
}

export function results_to_objects(res) {
  if (!res || res.length === 0) return [];
  const cols = res[0].columns;
  const values = res[0].values;
  return values.map((row) => {
    const o = {};
    for (let i = 0; i < cols.length; i++) o[cols[i]] = row[i];
    return o;
  });
}

export function fetchInstitutions(db, projectId) {
  let res;
  if (projectId) {
    res = db.exec(
      `SELECT i.*, 
              name_txt.content as name,
              desc_txt.content as description,
              country_txt.content as country,
              loc_txt.content as location
       FROM institutions i 
       LEFT JOIN texts name_txt ON i.name_id = name_txt.id
       LEFT JOIN texts desc_txt ON i.description_id = desc_txt.id
       LEFT JOIN texts country_txt ON i.country_id = country_txt.id
       LEFT JOIN texts loc_txt ON i.location_id = loc_txt.id
       WHERE i.project_id = ?`,
      [projectId]
    );
  } else {
    res = db.exec(
      `SELECT i.*, 
              name_txt.content as name,
              desc_txt.content as description,
              country_txt.content as country,
              loc_txt.content as location
       FROM institutions i 
       LEFT JOIN texts name_txt ON i.name_id = name_txt.id
       LEFT JOIN texts desc_txt ON i.description_id = desc_txt.id
       LEFT JOIN texts country_txt ON i.country_id = country_txt.id
       LEFT JOIN texts loc_txt ON i.location_id = loc_txt.id`
    );
  }
  return results_to_objects(res);
}

export function fetchOntologyFields(db, projectId) {
  let res;
  if (projectId) {
    res = db.exec(
      'SELECT o.*, t.content as name FROM ontology_fields o LEFT JOIN texts t ON o.name_id = t.id WHERE o.project_id = ?',
      [projectId]
    );
  } else {
    res = db.exec(
      'SELECT o.*, t.content as name FROM ontology_fields o LEFT JOIN texts t ON o.name_id = t.id'
    );
  }
  return results_to_objects(res);
}

export function fetchResearchFields(db, projectId) {
  let res;
  if (projectId) {
    res = db.exec(
      `SELECT r.*, name_txt.content as name, desc_txt.content as description
       FROM research_fields r 
       LEFT JOIN texts name_txt ON r.name_id = name_txt.id
       LEFT JOIN texts desc_txt ON r.description_id = desc_txt.id
       WHERE r.project_id = ?`,
      [projectId]
    );
  } else {
    res = db.exec(
      `SELECT r.*, name_txt.content as name, desc_txt.content as description
       FROM research_fields r 
       LEFT JOIN texts name_txt ON r.name_id = name_txt.id
       LEFT JOIN texts desc_txt ON r.description_id = desc_txt.id`
    );
  }
  return results_to_objects(res);
}

export function fetchVocabularies(db, projectId) {
  let res;
  if (projectId) {
    res = db.exec(
      `
      SELECT v.*, t.content as name, dt.content as description, ga.path as main_asset_path
      FROM vocabularies v
      JOIN research_fields rf ON v.field_id = rf.id
      LEFT JOIN texts t ON v.option_id = t.id
      LEFT JOIN texts dt ON v.description_id = dt.id
      LEFT JOIN generic_assets ga ON v.main_asset_id = ga.id
      WHERE rf.project_id = ?
    `,
      [projectId]
    );
  } else {
    res = db.exec(
      'SELECT v.*, t.content as name, dt.content as description, ga.path as main_asset_path FROM vocabularies v LEFT JOIN texts t ON v.option_id = t.id LEFT JOIN texts dt ON v.description_id = dt.id LEFT JOIN generic_assets ga ON v.main_asset_id = ga.id'
    );
  }
  return results_to_objects(res);
}

export function fetchProject(db, projectId) {
  if (!projectId) return {};
  const res = db.exec(
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
  const arr = results_to_objects(res);
  return arr[0] || {};
}

/**
 * Fetch website settings for a project, including resolved title/about and logo path.
 * Returns a single row or null if none exist.
 * @param {import('sql.js').Database} db
 * @param {string|null} projectId
 * @returns {Object|null}
 */
export function fetchWebsiteSettings(db, projectId) {
  let res;
  if (projectId) {
    res = db.exec(
      `
      SELECT ws.*,
             tt.content AS title,
             at.content AS about,
             ga.path AS logo_asset_path
      FROM website_settings ws
      LEFT JOIN texts tt ON ws.title_id = tt.id
      LEFT JOIN texts at ON ws.about_id = at.id
      LEFT JOIN generic_assets ga ON ws.logo_id = ga.id
      WHERE ws.project_id = ?
      LIMIT 1
    `,
      [projectId]
    );
  } else {
    res = db.exec(
      `
      SELECT ws.*,
             tt.content AS title,
             at.content AS about,
             ga.path AS logo_asset_path
      FROM website_settings ws
      LEFT JOIN texts tt ON ws.title_id = tt.id
      LEFT JOIN texts at ON ws.about_id = at.id
      LEFT JOIN generic_assets ga ON ws.logo_id = ga.id
      LIMIT 1
    `
    );
  }
  const arr = results_to_objects(res);
  return arr[0] || null;
}

/**
 * Fetch a single object by ID, including linked assets, ontology fields,
 * research fields, and related datasources. Returns normalized arrays and
 * includes the object's name property.
 * @param {import('sql.js').Database} db
 * @param {string} objectId
 * @returns {{
 *  object: { id: string, name: string|null, created_at: string|null, updated_at: string|null, status: string|null, institution_id: string|null, project_id: string|null } | null,
 *  assets: any[],
 *  objectOntologyFields: any[],
 *  objectResearchFields: any[],
 *  datasources: any[]
 * }}
 */
export function fetchObjectById(db, objectId) {
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
      o.id, o.name, o.created_at, o.updated_at, o.status, o.institution_id, o.project_id,
      ${subqueries.assets} AS objects_assets_json,
      ${subqueries.ontology} AS objects_ontology_fields_json,
      ${subqueries.research} AS objects_research_fields_json,
      ${subqueries.datasources} AS datasources_json
    FROM objects o
    WHERE o.id = ?
    LIMIT 1
  `;

  const stmt = db.prepare(sql);
  stmt.bind([objectId]);
  let items = getResults(stmt);
  items = parseJsonFields(items);
  const row = items[0] || null;

  const toArray = (v) => (Array.isArray(v) ? v : v ? v : []);
  const assets = toArray(row?.objects_assets_json).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const objectOntologyFields = toArray(row?.objects_ontology_fields_json);
  const objectResearchFields = toArray(row?.objects_research_fields_json);
  const datasources = toArray(row?.datasources_json);

  const object = row
    ? {
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        status: row.status,
        institution_id: row.institution_id,
        project_id: row.project_id
      }
    : null;

  return { object, assets, objectOntologyFields, objectResearchFields, datasources };
}