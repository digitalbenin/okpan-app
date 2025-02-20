import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { dirname } from 'path';
import fs from 'fs';

// Get the database path from env
const dbPath = process.env.DB_FILE_NAME || 'src/db/local.db';

// Ensure the database directory exists
const dbDir = dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Debug logging
console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

// Create the SQLite client with proper URL format
const client = createClient({
    url: `file:${dbPath.replace(/\\/g, '/')}` // Ensure forward slashes for URLs
});

// Create Drizzle instance with schema
const db = drizzle(client, { schema });

export { db };