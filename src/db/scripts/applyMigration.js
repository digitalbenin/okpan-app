import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { populateInstitutionsSearchIndex } from './populateInstitutionsSearch.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Applies the institutions search migration and populates the index
 */
async function applyMigration() {
    // Connect to the database
    const dbPath = process.env.DB_FILE_NAME || 'src/db/local.db';
    const client = createClient({
        url: `file:${path.resolve(dbPath).replace(/\\/g, '/')}`
    });
    const db = drizzle(client, { schema });

    try {
        console.log('Setting up institutions search...');

        // Check if FTS table already exists
        const tableCheckResult = await client.execute({
            sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='institutions_search'"
        });
        const ftsTableExists = tableCheckResult.rows.length > 0;

        // Read the migration file
        const migrationPath = path.resolve(__dirname, '../migrations/001_create_institutions_search.sql');
        const sqlContent = fs.readFileSync(migrationPath, 'utf8');

        // Extract individual statements properly - handle CREATE TRIGGER blocks correctly
        let statements = [];
        let currentStatement = '';
        let inTriggerBlock = false;

        for (const line of sqlContent.split('\n')) {
            // Skip comment lines
            if (line.trim().startsWith('--')) continue;

            // Check if we're starting a trigger block
            if (line.includes('CREATE TRIGGER') && !inTriggerBlock) {
                inTriggerBlock = true;
                currentStatement = line;
            }
            // Check if we're ending a trigger block
            else if (inTriggerBlock && line.trim() === 'END;') {
                currentStatement += '\n' + line;
                statements.push(currentStatement.trim());
                currentStatement = '';
                inTriggerBlock = false;
            }
            // Inside a trigger block, accumulate lines
            else if (inTriggerBlock) {
                currentStatement += '\n' + line;
            }
            // Regular statement (not in trigger block)
            else if (line.trim() !== '') {
                currentStatement += ' ' + line.trim();

                // If the line ends with a semicolon and we're not in a trigger, it's the end of a statement
                if (line.trim().endsWith(';') && !inTriggerBlock) {
                    statements.push(currentStatement.trim());
                    currentStatement = '';
                }
            }
        }

        if (ftsTableExists) {
            console.log('FTS table already exists, skipping table creation');
            // Filter out the CREATE VIRTUAL TABLE statement if table exists
            statements = statements.filter(stmt => !stmt.includes('CREATE VIRTUAL TABLE'));
        } else {
            console.log('Creating FTS table and triggers...');

            // Make sure we execute the CREATE TABLE statement first if it doesn't exist
            const createTableStmt = statements.find(stmt => stmt.includes('CREATE VIRTUAL TABLE'));
            if (createTableStmt) {
                try {
                    await client.execute({ sql: createTableStmt });
                    console.log('Created FTS virtual table successfully');
                } catch (err) {
                    console.error(`Failed to create FTS table: ${err.message}`);
                    // If we can't create the table, we might as well stop
                    throw new Error('Cannot continue without creating the FTS table');
                }

                // Remove the CREATE TABLE statement from the list so we don't try again
                statements = statements.filter(stmt => !stmt.includes('CREATE VIRTUAL TABLE'));
            }
        }

        // Execute remaining statements (triggers)
        console.log('Setting up triggers...');
        for (const statement of statements) {
            if (statement.trim() === '') continue;

            try {
                await client.execute({ sql: statement });
                console.log(`✓ Executed trigger successfully`);
            } catch (err) {
                console.warn(`⚠ Warning: ${err.message}`);
            }
        }

        console.log('FTS setup complete, now populating search index...');

        // Populate the search index - pass both client and db objects
        await populateInstitutionsSearchIndex(client, db);

        console.log('✅ Search setup complete! The FTS index is ready to use.');
    } catch (error) {
        console.error('❌ Search setup failed:', error);
    } finally {
        await client.close();
    }
}

// Run the migration if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    applyMigration().catch(console.error);
}

export { applyMigration }; 