/**
 * This server hook initializes the database connection when the server starts.
 * It uses sql.js to load an SQLite database file into memory.
 * The database instance is then attached to `event.locals` to make it
 * available in all server-side endpoints (routes, actions).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { dev } from '$app/environment';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct the absolute path to the database file.
let dbPath;
if (dev) {
    // In development, the path is relative to the source file in `src/website/src/hooks.server.js`
    dbPath = path.resolve(__dirname, '../../db/local.db');
} else {
    // In production, the file is expected to be in the 'static' folder, which gets copied to the build root.
    dbPath = 'local.db';
}

let db = null;

/**
 * Initializes the database from the .db file.
 * If the file doesn't exist, it creates a new in-memory database.
 */
async function initializeDatabase() {
    // sql.js needs to be initialized with the wasm file.
    // We assume it's located in a place where sql.js can find it automatically.
    const SQL = await initSqlJs();

    try {
        const filebuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(filebuffer);
        console.log('Database loaded into memory from:', dbPath);
    } catch (error) {
        console.error(`Could not load database from ${dbPath}.`, error);
        console.log('Creating a new empty in-memory database.');
        // If the file can't be read (e.g., it doesn't exist), create an empty DB.
        db = new SQL.Database();
    }
}

// Initialize the database on server startup.
// The `await` here on the top level is allowed in ES modules.
await initializeDatabase();

/**
 * SvelteKit hook to attach the database to the request event.
 * @type {import('@sveltejs/kit').Handle}
 */
export async function handle({ event, resolve }) {
    // Add the database instance to event.locals.
    // It can now be accessed in any server-side code (e.g., `+server.js`, `load` functions).
    event.locals.db = db;

    const response = await resolve(event);
    return response;
}