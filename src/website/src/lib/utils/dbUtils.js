import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let dbPromise = null;

/**
 * Initialize the client-side sql.js database from a static asset.
 * Subsequent calls return the same promise.
 * @param {string} dbUrl path to the DB file served from /static (default: '/local.db')
 * @returns {Promise<import('sql.js').Database>}
 */
export function initClientDb(dbUrl = '/local.db') {
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