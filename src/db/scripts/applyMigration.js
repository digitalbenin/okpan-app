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

const resolveMigrationPath = (fileName) => {
    const migrationPath = path.resolve(process.cwd(), 'src', 'db', 'migrations', fileName);

    if (fs.existsSync(migrationPath)) {
        return migrationPath;
    }

    throw new Error(`Migration file not found: ${migrationPath}`);
};

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
        const migrationPath = resolveMigrationPath('001_create_institutions_search.sql');
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
        const objectsMigrationPath = resolveMigrationPath('002_create_object_search_fts.sql');
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

        // --- Change log triggers for core and junction tables ---
        console.log('Applying change_log triggers for core tables (003)...');
            const changeLogCorePath = resolveMigrationPath('003_change_log_triggers.sql');
        if (fs.existsSync(changeLogCorePath)) {
            const changeLogCoreSql = fs.readFileSync(changeLogCorePath, 'utf8');

            // Drop existing core change_log triggers to ensure updates reapply cleanly
            const coreTriggerNames = [
                // project
                'trg_project_change_log_insert',
                'trg_project_change_log_update',
                'trg_project_change_log_delete',
                // settings
                'trg_settings_change_log_insert',
                'trg_settings_change_log_update',
                'trg_settings_change_log_delete',
                // website_settings
                'trg_website_settings_change_log_insert',
                'trg_website_settings_change_log_update',
                'trg_website_settings_change_log_delete',
                // object_display_fields
                'trg_object_display_fields_change_log_insert',
                'trg_object_display_fields_change_log_update',
                'trg_object_display_fields_change_log_delete',
                // research_fields
                'trg_research_fields_change_log_insert',
                'trg_research_fields_change_log_update',
                'trg_research_fields_change_log_delete',
                // ontology_fields
                'trg_ontology_fields_change_log_insert',
                'trg_ontology_fields_change_log_update',
                'trg_ontology_fields_change_log_delete',
                // assets
                'trg_assets_change_log_insert',
                'trg_assets_change_log_update',
                'trg_assets_change_log_delete',
                // generic_assets
                'trg_generic_assets_change_log_insert',
                'trg_generic_assets_change_log_update',
                'trg_generic_assets_change_log_delete',
                // objects
                'trg_objects_change_log_insert',
                'trg_objects_change_log_update',
                'trg_objects_change_log_delete',
                // templates
                'trg_templates_change_log_insert',
                'trg_templates_change_log_update',
                'trg_templates_change_log_delete',
                // languages
                'trg_languages_change_log_insert',
                'trg_languages_change_log_update',
                'trg_languages_change_log_delete',
                // institutions
                'trg_institutions_change_log_insert',
                'trg_institutions_change_log_update',
                'trg_institutions_change_log_delete',
                // texts
                'trg_texts_change_log_insert',
                'trg_texts_change_log_update',
                'trg_texts_change_log_delete',
                // translations
                'trg_translations_change_log_insert',
                'trg_translations_change_log_update',
                'trg_translations_change_log_delete',
                // vocabularies
                'trg_vocabularies_change_log_insert',
                'trg_vocabularies_change_log_update',
                'trg_vocabularies_change_log_delete',
                // datasources
                'trg_datasources_change_log_insert',
                'trg_datasources_change_log_update',
                'trg_datasources_change_log_delete',
                // imports
                'trg_imports_change_log_insert',
                'trg_imports_change_log_update',
                'trg_imports_change_log_delete'
            ];
            for (const tname of coreTriggerNames) {
                try {
                    await client.execute({ sql: `DROP TRIGGER IF EXISTS ${tname};` });
                } catch (err) {
                    console.warn(`⚠ Warning (drop core trigger ${tname}): ${err.message}`);
                }
            }

            let coreStatements = [];
            let coreCurrent = '';
            let coreInTrigger = false;
            for (const rawLine of changeLogCoreSql.split('\n')) {
                const line = rawLine.trimEnd();
                if (line.trim().startsWith('--')) continue;

                if (line.includes('CREATE TRIGGER') && !coreInTrigger) {
                    coreInTrigger = true;
                    coreCurrent = line.trim();
                    continue;
                }
                if (coreInTrigger) {
                    coreCurrent += '\n' + line;
                    if (line.trim() === 'END;') {
                        coreStatements.push(coreCurrent.trim());
                        coreCurrent = '';
                        coreInTrigger = false;
                    }
                    continue;
                }

                if (line.trim() !== '') {
                    coreCurrent += ' ' + line.trim();
                    if (line.trim().endsWith(';')) {
                        coreStatements.push(coreCurrent.trim());
                        coreCurrent = '';
                    }
                }
            }

            for (const stmt of coreStatements) {
                if (!stmt) continue;
                try {
                    await client.execute({ sql: stmt });
                    console.log('✓ Executed change_log core trigger');
                } catch (err) {
                    console.warn(`⚠ Warning (change_log core): ${err.message}`);
                }
            }
            console.log('✅ Applied change_log core triggers');
        } else {
            console.log('⚠ 003_change_log_triggers.sql not found; skipping');
        }

        console.log('Applying change_log triggers for junction tables (004)...');
            const changeLogJunctionPath = resolveMigrationPath('004_change_log_junction_triggers.sql');
        if (fs.existsSync(changeLogJunctionPath)) {
            const changeLogJunctionSql = fs.readFileSync(changeLogJunctionPath, 'utf8');

            // Drop existing junction change_log triggers to ensure updates reapply cleanly
            const junctionTriggerNames = [
                'trg_objects_assets_change_log_insert',
                'trg_objects_assets_change_log_update',
                'trg_objects_assets_change_log_delete',
                'trg_assets_institutions_change_log_insert',
                'trg_assets_institutions_change_log_update',
                'trg_assets_institutions_change_log_delete',
                'trg_objects_research_fields_change_log_insert',
                'trg_objects_research_fields_change_log_update',
                'trg_objects_research_fields_change_log_delete',
                'trg_objects_ontology_fields_change_log_insert',
                'trg_objects_ontology_fields_change_log_update',
                'trg_objects_ontology_fields_change_log_delete',
                'trg_vocabularies_generic_assets_change_log_insert',
                'trg_vocabularies_generic_assets_change_log_update',
                'trg_vocabularies_generic_assets_change_log_delete'
            ];
            for (const tname of junctionTriggerNames) {
                try {
                    await client.execute({ sql: `DROP TRIGGER IF EXISTS ${tname};` });
                } catch (err) {
                    console.warn(`⚠ Warning (drop junction trigger ${tname}): ${err.message}`);
                }
            }

            let jStatements = [];
            let jCurrent = '';
            let jInTrigger = false;
            for (const rawLine of changeLogJunctionSql.split('\n')) {
                const line = rawLine.trimEnd();
                if (line.trim().startsWith('--')) continue;

                if (line.includes('CREATE TRIGGER') && !jInTrigger) {
                    jInTrigger = true;
                    jCurrent = line.trim();
                    continue;
                }
                if (jInTrigger) {
                    jCurrent += '\n' + line;
                    if (line.trim() === 'END;') {
                        jStatements.push(jCurrent.trim());
                        jCurrent = '';
                        jInTrigger = false;
                    }
                    continue;
                }

                if (line.trim() !== '') {
                    jCurrent += ' ' + line.trim();
                    if (line.trim().endsWith(';')) {
                        jStatements.push(jCurrent.trim());
                        jCurrent = '';
                    }
                }
            }

            for (const stmt of jStatements) {
                if (!stmt) continue;
                try {
                    await client.execute({ sql: stmt });
                    console.log('✓ Executed change_log junction trigger');
                } catch (err) {
                    console.warn(`⚠ Warning (change_log junction): ${err.message}`);
                }
            }
            console.log('✅ Applied change_log junction triggers');
        } else {
            console.log('⚠ 004_change_log_junction_triggers.sql not found; skipping');
        }
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