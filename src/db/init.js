const { drizzle } = require('drizzle-orm/libsql');
const { createClient } = require('@libsql/client');
const schema = require('./schema.js');
const { dirname } = require('path');
const fs = require('fs');
const { buildSchema } = require('drizzle-graphql');

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
const graphqlSchema = buildSchema(db);

module.exports = { db, graphqlSchema };