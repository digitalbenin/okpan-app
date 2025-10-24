import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { populateInstitutionsSearchIndex } from './populateInstitutionsSearch.js';
import { populateObjectSearchIndexes } from './populateObjectSearchIndexes.js';

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

        // First, let's handle the CREATE VIRTUAL TABLE statement separately to ensure it's processed correctly
        if (!ftsTableExists) {
            console.log('Creating FTS table...');
            const ftsTableSql = sqlContent.split(';')[0] + ';'; // Extract just the first statement which should be the CREATE VIRTUAL TABLE

            try {
                await client.execute({ sql: ftsTableSql });
                console.log('Created FTS virtual table successfully');
            } catch (err) {
                console.error(`Failed to create FTS table: ${err.message}`);
                // If we can't create the table, we might as well stop
                throw new Error('Cannot continue without creating the FTS table');
            }
        } else {
            console.log('FTS table already exists, skipping table creation');
        }

        // Now handle the trigger statements
        console.log('Setting up triggers...');
        // Extract individual statements properly - handle CREATE TRIGGER blocks correctly
        let statements = [];
        let currentStatement = '';
        let inTriggerBlock = false;

        // Skip the CREATE VIRTUAL TABLE statement since we've already handled it
        const sqlContentWithoutCreateTable = sqlContent.substring(sqlContent.indexOf(';') + 1);

        for (const line of sqlContentWithoutCreateTable.split('\n')) {
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

        // Execute remaining statements (triggers)
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

        // --- Objects search migration and population ---
        console.log('Setting up objects search...');
        const objectsMigrationPath = path.resolve(__dirname, '../migrations/002_create_object_search_fts.sql');
        const objectsSql = fs.readFileSync(objectsMigrationPath, 'utf8');

        // Build statements, keeping CREATE TRIGGER blocks intact
        let objStatements = [];
        let objCurrent = '';
        let objInTrigger = false;
        for (const rawLine of objectsSql.split('\n')) {
            const line = rawLine.trimEnd();
            if (line.trim().startsWith('--')) continue;

            if (line.includes('CREATE TRIGGER') && !objInTrigger) {
                objInTrigger = true;
                objCurrent = line.trim();
                continue;
            }
            if (objInTrigger) {
                objCurrent += '\n' + line;
                if (line.trim() === 'END;') {
                    objStatements.push(objCurrent.trim());
                    objCurrent = '';
                    objInTrigger = false;
                }
                continue;
            }

            if (line.trim() !== '') {
                objCurrent += ' ' + line.trim();
                if (line.trim().endsWith(';')) {
                    objStatements.push(objCurrent.trim());
                    objCurrent = '';
                }
            }
        }

        for (const stmt of objStatements) {
            if (!stmt) continue;
            try {
                await client.execute({ sql: stmt });
                console.log('✓ Executed objects migration statement');
            } catch (err) {
                console.warn(`⚠ Warning (objects migration): ${err.message}`);
            }
        }

        console.log('FTS setup for objects complete, now populating search index...');
        await populateObjectSearchIndexes(client, db);
        console.log('✅ Objects search setup complete!');
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