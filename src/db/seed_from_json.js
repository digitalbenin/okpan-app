import { db } from './init.js';
import {
    languages, project, institutions, texts, objects, assets,
    objects_assets, research_fields, vocabularies, objects_research_fields,
    ontology_fields, datasources, objects_ontology_fields, templates, objects_datasources, globalSettings
} from './schema.js';
import { v4 as uuidv4 } from 'uuid';
import { sql, eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import electron from 'electron';
import { handleImportAssets } from '../backend/handlers/assetHandlers.js';
import { embeddingService } from '../backend/services/embeddingService.js';
import { destroyTorrentManager } from '../backend/services/assetTorrentManagerService.js';
import { resolveApplicationRoot } from './runtimeDatabasePaths.js';

const APP_ROOT = resolveApplicationRoot();

const KNOWN_SOURCE_LANGUAGES = {
    en: { code: 'en', name: 'English' },
    english: { code: 'en', name: 'English' },
    it: { code: 'it', name: 'Italian' },
    italian: { code: 'it', name: 'Italian' },
    de: { code: 'de', name: 'German' },
    german: { code: 'de', name: 'German' },
    fr: { code: 'fr', name: 'French' },
    french: { code: 'fr', name: 'French' },
    es: { code: 'es', name: 'Spanish' },
    spanish: { code: 'es', name: 'Spanish' },
    nl: { code: 'nl', name: 'Dutch' },
    dutch: { code: 'nl', name: 'Dutch' },
    pt: { code: 'pt', name: 'Portuguese' },
    portuguese: { code: 'pt', name: 'Portuguese' }
};

// --- Configuration & Argument Parsing ---
const DEFAULT_SEED_DATA_PATH = path.join(APP_ROOT, 'src', 'db', 'seed_data');
const HELP_TEXT = `
Usage: yarn db:seed [options]

Options:
  --data-path <path>  Specify the path to the seed data directory.
                      Defaults to '${DEFAULT_SEED_DATA_PATH}'.
  -h, --help          Display this help message.
`;
// --- End Configuration ---

function printSeedFromJsonHelp() {
    console.log(HELP_TEXT);
}

function getSeedFromJsonOptions(argv = process.argv.slice(2)) {
    const showHelp = argv.includes('-h') || argv.includes('--help');
    const dataPathIndex = argv.indexOf('--data-path');
    const hasCustomDataPath = dataPathIndex !== -1 && Boolean(argv[dataPathIndex + 1]);

    return {
        showHelp,
        seedDataPath: hasCustomDataPath
            ? path.resolve(argv[dataPathIndex + 1])
            : DEFAULT_SEED_DATA_PATH,
        hasCustomDataPath,
    };
}

// Helper function to read JSON files
const readJsonData = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading JSON file ${filePath}:`, error);
        throw error;
    }
};

const normalizeProjectLanguage = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
        return null;
    }

    return KNOWN_SOURCE_LANGUAGES[normalizedValue] || null;
};

const getSeedProjectAppVersion = async () => {
    const [settingsRow] = await db
        .select({ appVersion: globalSettings.app_version })
        .from(globalSettings)
        .where(eq(globalSettings.id, 1))
        .limit(1);

    return settingsRow?.appVersion || process.env.npm_package_version || 'dev';
};

// Helper function to create a text entry
const createTextEntry = async (content, context, languageId) => {
    if (!content || typeof content !== 'string' || content.trim() === '') {
        return null;
    }
    const [textEntry] = await db.insert(texts).values({
        id: uuidv4(),
        content: content,
        context: context,
        original_language_id: languageId
    }).returning();
    return textEntry?.id || null;
};

// Helper to find local asset path
const findAssetPath = async (assetName, seedDataPath, subfolders = ['images', 'edo_images']) => {
    const baseAssetPath = seedDataPath;
    for (const subfolder of subfolders) {
        const potentialPath = path.join(baseAssetPath, subfolder, assetName);
        try {
            await fs.access(potentialPath);
            return potentialPath;
        } catch {
            // File not found in this subfolder, try next
        }
    }
    console.warn(`Asset ${assetName} not found in provided subfolders.`);
    return null;
};


/**
 * Seeds the database with sample data loaded from a directory of JSON files.
 * Requires an Electron runtime — the database path is resolved via Electron's `userData` directory.
 *
 * Expected files in `seedDataPath`: `institutions.json`, `objects.json`,
 * `data_sources.json`, `edo_designations.json`.
 *
 * @param {{ seedDataPath?: string }} [options]
 * @returns {Promise<void>}
 * @ignore
 */
export const seedFromJson = async ({ seedDataPath = DEFAULT_SEED_DATA_PATH, userDataPath } = {}) => {
    try {
        console.log(`Using seed data path: ${seedDataPath}`);
        console.log('Starting seeding process from JSON data...');

        // --- 0. Load JSON Data ---
        const baseDataPath = seedDataPath;
        const institutionsData = await readJsonData(path.join(baseDataPath, 'institutions.json'));
        const objectsData = await readJsonData(path.join(baseDataPath, 'objects.json'));
        const dataSourcesData = await readJsonData(path.join(baseDataPath, 'data_sources.json'));
        const edoDesignationsData = await readJsonData(path.join(baseDataPath, 'edo_designations.json'));
        console.log('JSON data loaded.');

        // --- 1. Basic Setup (Project and Languages) ---
        const seedProjectAppVersion = await getSeedProjectAppVersion();
        const [projectRecord] = await db.insert(project).values({
            id: uuidv4(),
            title_id: null,
            description_id: null,
            is_shared: 0,
            created_app_version: seedProjectAppVersion
        }).returning();
        const mainProjectId = projectRecord.id;

        // Seed projects always start with the default editable pair English + Italian.
        const [englishLangRes, italianLangRes] = await Promise.all([
            db.insert(languages).values({
                id: uuidv4(),
                project_id: mainProjectId,
                code: 'en',
                name: 'English',
                is_default: 1
            }).returning(),
            db.insert(languages).values({
                id: uuidv4(),
                project_id: mainProjectId,
                code: 'it',
                name: 'Italian',
                is_default: 0
            }).returning()
        ]);
        const englishLang = englishLangRes[0];

        if (!englishLang) {
            throw new Error('Failed to create the default English project language.');
        }

        // Create project texts with language IDs
        const projectTitleId = await createTextEntry('Digital Benin Archive (Seeded from JSON)', 'project.title', englishLang.id);
        const projectDescriptionId = await createTextEntry('A collection of Benin artifacts and their histories, seeded from JSON data provided in the seed_data folder.', 'project.description', englishLang.id);

        // Update project with text references
        await db.update(project)
            .set({
                title_id: projectTitleId,
                description_id: projectDescriptionId
            })
            .where(eq(project.id, mainProjectId));

        console.log(`Project and languages seeded.`);

        // --- 2. Ontology Fields & Categories (redefined based on images) ---
        const categoryMap = {
            "object_information": "Object Information",
            "object_production": "Object Production",
            "provenance": "Provenance",
            "object_context": "Object Context",
            "institution_context": "Institution Context"
        };
        const categoryTextEntries = {};
        for (const [key, value] of Object.entries(categoryMap)) {
            const categoryTextId = await createTextEntry(value, `ontology.category.${key}`, englishLang.id);
            if (categoryTextId) {
                categoryTextEntries[key] = categoryTextId;
            } else {
                throw new Error(`Failed to create category text for ${key}`);
            }
        }

        const ontologyFieldsList = [
            // Object Information
            { name: "object id", description: "Unique identifier for the artifact.", category: "object_information" },
            { name: "designation", description: "Official title or name.", category: "object_information" },
            { name: "description", description: "Brief summary of the artifact.", category: "object_information" },
            { name: "object type", description: "Category or type of artifact.", category: "object_information" },
            { name: "object count", description: "Number of items in the artifact group.", category: "object_information" },
            { name: "material", description: "Substance(s) used to create the artifact.", category: "object_information" },
            { name: "dimensions", description: "Size measurements (height, width, depth).", category: "object_information" },
            { name: "weight", description: "Weight of the artifact.", category: "object_information" },
            { name: "colour", description: "Dominant colors of the artifact.", category: "object_information" },
            { name: "iconography", description: "Symbols and imagery depicted.", category: "object_information" },
            { name: "inscriptions", description: "Any text or markings on the artifact.", category: "object_information" },

            // Object Production
            { name: "date made", description: "When the artifact was created.", category: "object_production" },
            { name: "producer", description: "Creator or maker of the artifact.", category: "object_production" },
            { name: "production technique", description: "Method used to create the artifact.", category: "object_production" },
            { name: "production place", description: "Location where the artifact was made.", category: "object_production" },

            // Provenance
            { name: "prior source", description: "Previous source of the artifact.", category: "provenance" },
            { name: "prior source role", description: "Role or title of the previous owner. (Prior Source Role in image)", category: "provenance" },
            { name: "provenance", description: "Artifact's history and ownership record.", category: "provenance" },
            { name: "event", description: "Historical event associated with the artifact.", category: "provenance" },
            { name: "date collected", description: "When the artifact was acquired.", category: "provenance" },
            { name: "place collected", description: "Location where the artifact was found.", category: "provenance" },

            // Object Context
            { name: "reign associated name", description: "Name of a ruler or figure linked to the artifact.", category: "object_context" },
            { name: "ethnic attribution", description: "Cultural or ethnic origin.", category: "object_context" },

            // Institution Context
            { name: "department and institution", description: "Museum or department housing the artifact.", category: "institution_context" },
            { name: "accession date", description: "Date the artifact was added to the collection.", category: "institution_context" },
            { name: "accession method", description: "How the artifact was acquired.", category: "institution_context" },
            { name: "notes", description: "Additional remarks or observations.", category: "institution_context" },
            { name: "exhibition history", description: "Past exhibitions featuring the artifact.", category: "institution_context" },
            { name: "display status", description: "Current display status (on display, in storage, etc.).", category: "institution_context" },
            { name: "legal status", description: "Legal ownership and rights.", category: "institution_context" },
            { name: "condition", description: "Current state of preservation.", category: "institution_context" },
            { name: "license", description: "Usage rights and permissions.", category: "institution_context" },
            { name: "bibliography", description: "References and sources related to the artifact.", category: "institution_context" },
            { name: "images", description: "Visual representations of the artifact.", category: "institution_context" },
            { name: "weblink", description: "Online link for more information.", category: "institution_context" }
        ];

        const ontologyFieldsByName = new Map();
        for (const field of ontologyFieldsList) {
            const nameId = await createTextEntry(field.name, 'ontology_fields.name', englishLang.id);
            const descriptionId = await createTextEntry(field.description, 'ontology_fields.description', englishLang.id);
            const categoryId = categoryTextEntries[field.category];
            if (!nameId || !descriptionId || !categoryId) {
                throw new Error(`Failed to create text entries for ontology field ${field.name}`);
            }
            const [dbField] = await db.insert(ontology_fields).values({
                id: uuidv4(),
                name_id: nameId,
                description_id: descriptionId,
                category_id: categoryId,
                project_id: mainProjectId
            }).returning();
            ontologyFieldsByName.set(field.name.toLowerCase(), dbField.id);
        }
        console.log(`${ontologyFieldsList.length} ontology fields seeded.`);

        // --- Compute Embeddings for Ontology Fields ---
        console.log('Computing embeddings for ontology fields...');
        try {
            await embeddingService.initialize();

            let embeddingCount = 0;
            for (const fieldId of ontologyFieldsByName.values()) {
                const fieldWithTexts = await db
                    .select({
                        field_id: ontology_fields.id,
                        name_content: texts.content,
                        description_content: texts.content
                    })
                    .from(ontology_fields)
                    .leftJoin(texts, sql`${ontology_fields.name_id} = ${texts.id}`)
                    .where(sql`${ontology_fields.id} = ${fieldId}`)
                    .execute();

                if (fieldWithTexts.length > 0) {
                    const field = fieldWithTexts[0];
                    const embedding = await embeddingService.computeOntologyFieldEmbedding(
                        field.name_content,
                        field.description_content
                    );

                    if (embedding) {
                        await db
                            .update(ontology_fields)
                            .set({ embeddings: embedding })
                            .where(sql`${ontology_fields.id} = ${fieldId}`)
                            .execute();
                        embeddingCount++;
                    }
                }
            }
            console.log(`${embeddingCount} embeddings computed successfully.`);
        } catch (error) {
            console.warn('Warning: Failed to compute embeddings during seeding:', error.message);
            console.log('You can compute them later using: window.api.computeAllMissingEmbeddings()');
        }

        // --- 4. Seed Institutions ---
        const institutionMap = new Map();
        for (const instData of institutionsData) {
            const nameId = await createTextEntry(instData.name, 'institutions.name', englishLang.id);
            const locationString = instData.location || "";
            const locationId = await createTextEntry(locationString, 'institutions.location', englishLang.id);
            const countryId = await createTextEntry(locationString, 'institutions.country', englishLang.id);

            let processedLinks = [];
            if (instData.links && Array.isArray(instData.links)) {
                processedLinks = instData.links.map(link => ({
                    url: link.url,
                    label: link.title // Map title to label
                }));
            }

            const [dbInstitution] = await db.insert(institutions).values({
                id: uuidv4(),
                name_id: nameId,
                location_id: locationId,
                country_id: countryId,
                project_id: mainProjectId,
                links: JSON.stringify(processedLinks), // Store the processed links
                website: instData.links?.find(l => l.title?.toLowerCase() === 'website')?.url || null,
                status: 'in progress' // Default status
            }).returning();
            institutionMap.set(instData.id, dbInstitution.id);
        }
        console.log(`${institutionsData.length} institutions seeded.`);

        // --- 5. Seed Data Sources ---
        const dataSourceMap = new Map(); // Map old ID to { newID, fieldMappings }
        const templateCountByInstitution = new Map();
        for (const dsData of dataSourcesData) {
            const newInstitutionId = institutionMap.get(dsData.institution);
            if (!newInstitutionId) {
                console.warn(`Institution ID ${dsData.institution} for data source ${dsData.id} not found in map. Skipping.`);
                continue;
            }

            const nextTemplateN = (templateCountByInstitution.get(newInstitutionId) || 0) + 1;
            templateCountByInstitution.set(newInstitutionId, nextTemplateN);
            const templateName = `template_${nextTemplateN}`;

            const dsName = `Data source for ${institutionsData.find(i => i.id === dsData.institution)?.name || dsData.institution}`;
            const nameId = await createTextEntry(dsName, 'datasources.name', englishLang.id);
            const methodId = await createTextEntry(dsData.method, 'datasources.method', englishLang.id);
            const normalizedSourceLanguage = normalizeProjectLanguage(dsData.languages?.[0]);
            const datasourceLanguageCode = normalizedSourceLanguage?.code || englishLang.code;

            const [dbDataSource] = await db.insert(datasources).values({
                id: uuidv4(),
                name_id: nameId,
                institution_id: newInstitutionId,
                language: datasourceLanguageCode,
                method_id: methodId,
                date: dsData.date ? new Date(dsData.date) : new Date(),
                source: `seed_data_${dsData.institution}_${dsData.id}.csv` // Add fake filename as source
            }).returning();

            // Build a mapping array - one entry per ontology field mapping
            const mappingArray = [];
            if (Array.isArray(dsData.fields)) {
                for (const f of dsData.fields) {
                    if (f.fieldLinks && f.fieldLinks.length > 0) {
                        // Create one entry for each target ontology field
                        for (const fieldLink of f.fieldLinks) {
                            const mappedFieldId = ontologyFieldsByName.get(String(fieldLink).toLowerCase()) || null;
                            mappingArray.push({
                                headerField: f.field,
                                mappedField: mappedFieldId,
                                primary: f.primary ? 1 : 0
                            });
                        }
                    } else {
                        // No fieldLinks, use field name as fallback
                        const mappedFieldId = ontologyFieldsByName.get(String(f.field).toLowerCase()) || null;
                        mappingArray.push({
                            headerField: f.field,
                            mappedField: mappedFieldId,
                            primary: f.primary ? 1 : 0
                        });
                    }
                }
            }

            // Ensure at least one field is marked as primary in the template
            if (mappingArray.length > 0 && !mappingArray.some(m => m.primary === 1)) {
                // Try to find an "object id" related field first
                const objectIdIndex = mappingArray.findIndex(m => 
                    m.headerField && (
                        m.headerField.toLowerCase().includes('object id') ||
                        m.headerField.toLowerCase().includes('museum number') ||
                        m.headerField.toLowerCase().includes('accession number')
                    )
                );
                
                if (objectIdIndex !== -1) {
                    mappingArray[objectIdIndex].primary = 1;
                    console.log(`Auto-marked '${mappingArray[objectIdIndex].headerField}' as primary in template for datasource ${dsData.id}`);
                } else {
                    // If no ID field found, mark the first field as primary
                    mappingArray[0].primary = 1;
                    console.log(`Auto-marked first field '${mappingArray[0].headerField}' as primary in template for datasource ${dsData.id}`);
                }
            }

            // Create a template for this datasource (linked via objects_datasources later)
            let createdTemplateId = null;
            try {
                const [createdTemplate] = await db.insert(templates).values({
                    id: uuidv4(),
                    name: templateName,
                    mapping: JSON.stringify(mappingArray),
                    project_id: mainProjectId,
                    institution_id: newInstitutionId,
                    asset_map_rule: null
                }).returning();

                createdTemplateId = createdTemplate?.id || null;
            } catch (templateErr) {
                console.warn(`Failed to create template for datasource ${dsData.id}:`, templateErr?.message || templateErr);
            }

            // Store field mappings as arrays to support one-to-many mappings
            const fieldMappings = new Map();
            dsData.fields.forEach(f => {
                const fieldKey = f.field.toLowerCase();
                if (f.fieldLinks && f.fieldLinks.length > 0) {
                    fieldMappings.set(fieldKey, f.fieldLinks.map(link => String(link).toLowerCase()));
                } else {
                    fieldMappings.set(fieldKey, [String(f.field).toLowerCase()]);
                }
            });
            dataSourceMap.set(dsData.id, { newID: dbDataSource.id, fieldMappings, templateId: createdTemplateId });
        }
        console.log(`${dataSourceMap.size} data sources seeded.`);

        // --- 6. Seed Research Field (Edo Designation) and Vocabularies ---
        const edoRfNameId = await createTextEntry("Edo Designation", 'research_fields.name', englishLang.id);
        const edoRfDescId = await createTextEntry("Vocabulary for Edo designations of objects.", 'research_fields.description', englishLang.id);

        const [edoResearchField] = await db.insert(research_fields).values({
            id: uuidv4(),
            name_id: edoRfNameId,
            description_id: edoRfDescId,
            project_id: mainProjectId,
            type: 'vocabulary'
        }).returning();

        const edoVocabularyMap = new Map(); // Map old Edo ID to new vocabulary DB ID
        for (const edoData of edoDesignationsData) {
            const nameId = await createTextEntry(edoData.name, 'vocabularies.option', englishLang.id);
            const descriptionId = await createTextEntry(edoData.description, 'vocabularies.description', englishLang.id);
            let newAssetId = null;
            if (edoData.asset) {
                // For vocabulary assets from edo_designations.json, specifically look only in the 'edo_images' subfolder.
                const localAssetPath = await findAssetPath(edoData.asset, seedDataPath, ['edo_images']);

                if (localAssetPath) {
                    const assetData = {
                        path: [localAssetPath],
                        isDirectory: false,
                        projectId: mainProjectId,
                        institutionId: null,
                                isGenericAsset: true,
                                disableP2P: true,
                                userDataPath
                    };
                    try {
                        const importResult = await handleImportAssets(null, assetData);
                        if (importResult?.createdAssets?.length > 0) {
                            newAssetId = importResult.createdAssets[0].id;
                        }
                    } catch (e) {
                        console.warn(`Failed to import vocabulary asset ${edoData.asset}: ${e.message}`);
                    }
                } else {
                    console.warn(`Vocabulary asset '${edoData.asset}' not found in edo_images folder`);
                }
            }

            const [dbVocabulary] = await db.insert(vocabularies).values({
                id: uuidv4(),
                option_id: nameId,
                description_id: descriptionId,
                field_id: edoResearchField.id,
                main_asset_id: newAssetId
            }).returning();
            edoVocabularyMap.set(edoData.id, dbVocabulary.id);
        }
        console.log(`Edo Designation research field and ${edoDesignationsData.length} vocabularies seeded.`);

        // Add freetext research field: 'notes'
        const notesRfNameId = await createTextEntry('notes', 'research_fields.name', englishLang.id);
        const notesRfDescId = await createTextEntry('Free text notes on objects.', 'research_fields.description', englishLang.id);
        const [notesResearchField] = await db.insert(research_fields).values({
            id: uuidv4(),
            name_id: notesRfNameId,
            description_id: notesRfDescId,
            project_id: mainProjectId,
            type: 'freetext'
        }).returning();
        console.log(`Seeded freetext research field 'notes' with id ${notesResearchField.id}`);

        // --- 7. Seed Objects ---
        // Define which ontology fields are considered "description-like"
        const descriptionOntologyFieldNames = new Set(['description', 'designation']);

        // Track created object IDs to attach notes later
        const seededObjectIds = [];

        for (const objData of objectsData) {
            const newInstitutionId = institutionMap.get(objData.institution);
            if (!newInstitutionId) {
                console.warn(`Institution ID ${objData.institution} for object ${objData.id} not found. Skipping.`);
                continue;
            }

            const [dbObject] = await db.insert(objects).values({
                id: uuidv4(), // Generate new UUID for the object
                institution_id: newInstitutionId,
                project_id: mainProjectId,
                status: 'in progress' // Default status
            }).returning();

            // Keep for later to attach notes
            seededObjectIds.push(dbObject.id);

            // Track the object's primary identifier to set the new title field
            // Default to the generated object UUID if no external primary id is found
            let objectPrimaryIdValue = dbObject.id;

            // Handle Edo Designations
            if (objData.edo_designations && objData.edo_designations.length > 0) {
                const oldEdoDesignationId = objData.edo_designations[0];
                const newVocabularyId = edoVocabularyMap.get(oldEdoDesignationId);
                if (newVocabularyId) {
                    await db.insert(objects_research_fields).values({
                        id: uuidv4(),
                        object_id: dbObject.id,
                        field_id: edoResearchField.id,
                        vocabulary_id: newVocabularyId
                    });
                } else {
                    console.warn(`Edo Designation ID ${oldEdoDesignationId} for object ${objData.id} not found in map.`);
                }
            }

            if (objData.images?.length > 0) {
                for (const [index, imgData] of objData.images.entries()) {
                    if (imgData.asset) {
                        const localImgPath = await findAssetPath(imgData.asset, seedDataPath);
                        if (localImgPath) {
                            const assetData = {
                                path: [localImgPath],
                                isDirectory: false,
                                projectId: mainProjectId,
                                institutionId: newInstitutionId,
                                isGenericAsset: false,
                                disableP2P: true,
                                userDataPath
                            };
                            try {
                                const importResult = await handleImportAssets(null, assetData);
                                if (importResult?.createdAssets?.length > 0) {
                                    await db.insert(objects_assets).values({
                                        id: uuidv4(),
                                        asset_id: importResult.createdAssets[0].id,
                                        object_id: dbObject.id,
                                        order: index + 1
                                    });
                                }
                            } catch (e) {
                                console.warn(`Failed to import image ${imgData.asset}: ${e.message}`);
                            }
                        }
                    }
                }
            }

            // Handle Metadata (Ontology Fields)
            if (objData.metadata && objData.metadata.length > 0) {
                for (const metadataEntry of objData.metadata) {
                    const dsInfo = dataSourceMap.get(metadataEntry.data_source);
                    if (!dsInfo) {
                        console.warn(`Data source ID ${metadataEntry.data_source} for object ${objData.id} metadata not found. Skipping metadata block.`);
                        continue;
                    }
                    const { newID: newDataSourceId, fieldMappings, templateId } = dsInfo;

                    // Insert into objects_datasources junction table
                    try {
                        await db.insert(objects_datasources).values({
                            object_id: dbObject.id,
                            datasource_id: newDataSourceId,
                            template_id: templateId || null
                        });
                    } catch (odErr) {
                        // Ignore duplicate key errors if object already linked to this datasource
                        if (!odErr?.message?.includes('UNIQUE constraint failed')) {
                            console.warn(`Failed to link object ${dbObject.id} to datasource ${newDataSourceId}:`, odErr?.message || odErr);
                        }
                    }

                    // Check if any field is marked as primary in the source data
                    const hasPrimaryField = metadataEntry.metadata.some(f => f.primary);
                    let primaryFieldAssigned = false;

                    for (const fieldValuePair of metadataEntry.metadata) {
                        const sourceFieldName = fieldValuePair.field;
                        const ontologyFieldNames = fieldMappings.get(sourceFieldName.toLowerCase());

                        if (!ontologyFieldNames || ontologyFieldNames.length === 0) {
                            console.warn(`No ontology field mapping for source field '${sourceFieldName}' in object ${objData.id}. Using source field name directly.`);
                        }
                        
                        const targetOntologyFieldNames = ontologyFieldNames || [sourceFieldName.toLowerCase()];
                        const isPrimary = fieldValuePair.primary ? 1 : 0;

                        // Create one entry for each target ontology field
                        for (const targetOntologyFieldName of targetOntologyFieldNames) {
                            const ontologyFieldDbId = ontologyFieldsByName.get(targetOntologyFieldName);

                            // Capture the "primary id" value for the object title if present
                            if (
                                isPrimary === 1 &&
                                targetOntologyFieldName === 'object id' &&
                                fieldValuePair.value !== null &&
                                typeof fieldValuePair.value !== 'undefined' &&
                                String(fieldValuePair.value).trim() !== ''
                            ) {
                                objectPrimaryIdValue = String(fieldValuePair.value);
                            }

                            if (ontologyFieldDbId && fieldValuePair.value !== null && typeof fieldValuePair.value !== "undefined" && String(fieldValuePair.value).trim() !== "") {
                                await db.insert(objects_ontology_fields).values({
                                    id: uuidv4(),
                                    object_id: dbObject.id,
                                    field_id: ontologyFieldDbId,
                                    datasources_id: newDataSourceId,
                                    label: sourceFieldName,
                                    value: String(fieldValuePair.value),
                                    primary: isPrimary,
                                    default_description: descriptionOntologyFieldNames.has(targetOntologyFieldName) ? 1 : 0
                                });
                                
                                if (isPrimary === 1) {
                                    primaryFieldAssigned = true;
                                }
                            }
                        }
                    }
                }
            }

            // Update the object title (name) with the resolved primary identifier value
            await db.update(objects)
                .set({ name: objectPrimaryIdValue })
                .where(eq(objects.id, dbObject.id));
        }

        // After creating all objects, attach two different notes to two random objects (if available)
        if (seededObjectIds.length > 0) {
            const pickUniqueIndices = (count, max) => {
                const set = new Set();
                while (set.size < Math.min(count, max)) {
                    set.add(Math.floor(Math.random() * max));
                }
                return Array.from(set);
            };

            const indices = pickUniqueIndices(2, seededObjectIds.length);
            const notesTexts = [
                'Curator note: requires condition assessment.',
                'Curator note: potential duplicate entry, verify provenance.'
            ];

            for (let i = 0; i < indices.length; i++) {
                const objId = seededObjectIds[indices[i]];
                const noteContent = notesTexts[i] || `Curator note #${i + 1}`;
                await db.insert(objects_research_fields).values({
                    id: uuidv4(),
                    object_id: objId,
                    field_id: notesResearchField.id,
                    vocabulary_id: null,
                    value: noteContent
                });
                console.log(`Added note to object ${objId.substring(0, 8)}…: ${noteContent}`);
            }
        }

        console.log(`${objectsData.length} objects seeded.`);

        console.log('Seed completed successfully!');
        destroyTorrentManager();
    } catch (error) {
        destroyTorrentManager();
        throw error;
    }
};

export async function runSeedFromJsonCli(argv = process.argv.slice(2)) {
    if (!process.versions?.electron) {
        throw new Error('The JSON seed must run through Electron. Use `yarn db:seed`.');
    }

    const { showHelp, seedDataPath } = getSeedFromJsonOptions(argv);

    if (showHelp) {
        printSeedFromJsonHelp();
        return 0;
    }

    // When running `electron script.js` directly, Electron defaults the app name to "Electron",
    // which causes userData to resolve to AppData\Roaming\Electron instead of the correct path.
    // Explicitly set the name from package.json before resolving any paths.
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { productName } = require(path.join(APP_ROOT, 'package.json'));
    electron.app.setName(productName);

    const userDataPath = electron.app.getPath('userData');
    console.log('Electron userData path:', userDataPath);

    try {
        await seedFromJson({ seedDataPath, userDataPath });
        return 0;
    } catch (error) {
        console.error('Error during seeding:', error);
        return 1;
    }
}

// This file is a CLI-only entrypoint; run unconditionally when executed via `yarn db:seed`
const exitCode = await runSeedFromJsonCli();
electron.app.exit(exitCode);