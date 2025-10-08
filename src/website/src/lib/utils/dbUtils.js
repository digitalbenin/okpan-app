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
 * @param {import('sql.js').Statement} stmt
 * @returns {Object[]}
 */
export function getResults(stmt) {
  try {
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
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