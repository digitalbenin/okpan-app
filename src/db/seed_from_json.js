import { db } from './init.js';
import {
    languages, project, project_languages, institutions, texts, objects as dbObjects, assets,
    objects_assets, research_fields, vocabularies, objects_research_fields,
    ontology_fields, datasources as dbDatasources, objects_ontology_fields,
} from './schema.js';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { handleImportAssets } from '../backend/handlers/assetHandlers.js';

// --- Configuration & Argument Parsing ---
const DEFAULT_SEED_DATA_PATH = path.join(process.cwd(), 'src', 'db', 'seed_data');
let seedDataPath = DEFAULT_SEED_DATA_PATH;

const args = process.argv.slice(2);

if (args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage: node src/db/seed_from_json.js [options]

Options:
  --data-path <path>  Specify the path to the seed data directory.
                      Defaults to '${DEFAULT_SEED_DATA_PATH}'.
  -h, --help          Display this help message.
    `);
    process.exit(0);
}

const dataPathIndex = args.indexOf('--data-path');
if (dataPathIndex !== -1 && args[dataPathIndex + 1]) {
    seedDataPath = path.resolve(args[dataPathIndex + 1]);
    console.log(`Using custom seed data path: ${seedDataPath}`);
} else {
    console.log(`Using default seed data path: ${seedDataPath}`);
}
// --- End Configuration ---

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

// Helper function to create a text entry
const createTextEntry = async (content, context, languageCode) => {
    if (content === null || typeof content === 'undefined' || content.trim() === '') {
        return null;
    }
    const [textEntry] = await db.insert(texts).values({
        id: uuidv4(),
        content: content,
        context: context,
        original_language: languageCode
    }).returning();
    return textEntry?.id || null;
};

// Helper to find local asset path
const findAssetPath = async (assetName, subfolders = ['images', 'edo_images']) => {
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


const seed = async () => {
    try {
        console.log('Starting seeding process from JSON data...');

        // --- 1. Basic Setup (Languages, Project) ---
        const [englishLangRes, italianLangRes] = await Promise.all([
            db.insert(languages).values({ code: 'en', name: 'English', id: uuidv4() }).returning(),
            db.insert(languages).values({ code: 'it', name: 'Italian', id: uuidv4() }).returning()
        ]);
        const englishLang = englishLangRes[0];
        const italianLang = italianLangRes[0];

        const projectTitleId = await createTextEntry('Digital Benin Archive (Seeded from JSON)', 'project.title', englishLang.code);
        const projectDescriptionId = await createTextEntry('A collection of Benin artifacts and their histories, seeded from JSON data provided in the seed_data folder.', 'project.description', englishLang.code);

        const [projectRecord] = await db.insert(project).values({
            id: uuidv4(),
            title_id: projectTitleId,
            description_id: projectDescriptionId
        }).returning();

        await Promise.all([
            db.insert(project_languages).values({ id: uuidv4(), project_id: projectRecord.id, language_code: englishLang.code, is_default: 1 }),
            db.insert(project_languages).values({ id: uuidv4(), project_id: projectRecord.id, language_code: italianLang.code, is_default: 0 })
        ]);
        console.log(`Project '${projectTitleId ? await db.select().from(texts).where(sql`${texts.id} = ${projectTitleId}`).then(r => r[0].content) : 'N/A'}' and languages seeded.`);

        // --- 2. Ontology Fields & Categories (reusing structure from original seed.js) ---
        const categoryMap = {
            "basic": "Basic Information", "physical": "Physical Attributes", "creation": "Creation Information",
            "history": "Historical Context", "acquisition": "Acquisition Details", "management": "Collection Management",
            "references": "References & Documentation"
        };
        const categoryTextEntries = {};
        for (const [key, value] of Object.entries(categoryMap)) {
            const categoryTextId = await createTextEntry(value, `ontology.category.${key}`, englishLang.code);
            if (categoryTextId) {
                categoryTextEntries[key] = categoryTextId;
            } else {
                throw new Error(`Failed to create category text for ${key}`);
            }
        }

        const ontologyFieldsList = [
            { name: "object id", description: "Unique identifier for the artifact.", category: "basic" },
            { name: "designation", description: "Official title or name.", category: "basic" },
            { name: "description", description: "Brief summary of the artifact.", category: "basic" },
            { name: "object type", description: "Category or type of artifact.", category: "basic" },
            { name: "object count", description: "Number of items in the artifact group.", category: "basic" },
            { name: "material", description: "Substance(s) used to create the artifact.", category: "physical" },
            { name: "dimensions", description: "Size measurements (height, width, depth).", category: "physical" },
            { name: "weight", description: "Weight of the artifact.", category: "physical" },
            { name: "colour", description: "Dominant colors of the artifact.", category: "physical" },
            { name: "condition", description: "Current state of preservation.", category: "physical" },
            { name: "date made", description: "When the artifact was created.", category: "creation" },
            { name: "producer", description: "Creator or maker of the artifact.", category: "creation" },
            { name: "production technique", description: "Method used to create the artifact.", category: "creation" },
            { name: "production place", description: "Location where the artifact was made.", category: "creation" },
            { name: "iconography", description: "Symbols and imagery depicted.", category: "creation" },
            { name: "inscriptions", description: "Any text or markings on the artifact.", category: "creation" },
            { name: "prior owner", description: "Previous owner of the artifact.", category: "history" },
            { name: "prior owner role", description: "Role or title of the previous owner.", category: "history" },
            { name: "provenance", description: "Artifact's history and ownership record.", category: "history" },
            { name: "event", description: "Historical event associated with the artifact.", category: "history" },
            { name: "reign associated name", description: "Name of a ruler or figure linked to the artifact.", category: "history" },
            { name: "ethnic attribution", description: "Cultural or ethnic origin.", category: "history" },
            { name: "date collected", description: "When the artifact was acquired.", category: "acquisition" },
            { name: "place collected", description: "Location where the artifact was found.", category: "acquisition" },
            { name: "department and institution", description: "Museum or department housing the artifact.", category: "acquisition" },
            { name: "accession date", description: "Date the artifact was added to the collection.", category: "acquisition" },
            { name: "accession method", description: "How the artifact was acquired.", category: "acquisition" },
            { name: "notes", description: "Additional remarks or observations.", category: "management" },
            { name: "exhibition history", description: "Past exhibitions featuring the artifact.", category: "management" },
            { name: "display status", description: "Current display status (on display, in storage, etc.).", category: "management" },
            { name: "legal status", description: "Legal ownership and rights.", category: "management" },
            { name: "license", description: "Usage rights and permissions.", category: "management" },
            { name: "bibliography", description: "References and sources related to the artifact.", category: "references" },
            { name: "images", description: "Visual representations of the artifact.", category: "references" },
            { name: "weblink", description: "Online link for more information.", category: "references" }
        ];

        const ontologyFieldsByName = new Map();
        for (const field of ontologyFieldsList) {
            const nameId = await createTextEntry(field.name, 'ontology_fields.name', englishLang.code);
            const descriptionId = await createTextEntry(field.description, 'ontology_fields.description', englishLang.code);
            const categoryId = categoryTextEntries[field.category];
            if (!nameId || !descriptionId || !categoryId) {
                throw new Error(`Failed to create text entries for ontology field ${field.name}`);
            }
            const [dbField] = await db.insert(ontology_fields).values({
                id: uuidv4(),
                name_id: nameId,
                description_id: descriptionId,
                category_id: categoryId
            }).returning();
            ontologyFieldsByName.set(field.name.toLowerCase(), dbField.id);
        }
        console.log(`${ontologyFieldsList.length} ontology fields seeded.`);

        // --- 3. Load JSON Data ---
        const baseDataPath = seedDataPath;
        const institutionsData = await readJsonData(path.join(baseDataPath, 'institutions.json'));
        const objectsData = await readJsonData(path.join(baseDataPath, 'objects.json'));
        const dataSourcesData = await readJsonData(path.join(baseDataPath, 'data_sources.json'));
        const edoDesignationsData = await readJsonData(path.join(baseDataPath, 'edo_designations.json'));
        console.log('JSON data loaded.');

        // --- 4. Seed Institutions ---
        const institutionMap = new Map();
        for (const instData of institutionsData) {
            const nameId = await createTextEntry(instData.name, 'institutions.name', englishLang.code);
            const locationString = instData.location || "";
            const locationId = await createTextEntry(locationString, 'institutions.location', englishLang.code);

            let countryName = "Unknown";
            if (locationString) {
                const parts = locationString.split(',');
                if (parts.length > 0) {
                    countryName = parts[parts.length - 1].trim();
                }
            }
            const countryId = await createTextEntry(countryName, 'institutions.country', englishLang.code);

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
                project_id: projectRecord.id,
                links: JSON.stringify(processedLinks), // Store the processed links
                website: instData.links?.find(l => l.title?.toLowerCase() === 'website')?.url || null,
                status: 'in progress' // Default status
            }).returning();
            institutionMap.set(instData.id, dbInstitution.id);
        }
        console.log(`${institutionsData.length} institutions seeded.`);

        // --- 5. Seed Data Sources ---
        const dataSourceMap = new Map(); // Map old ID to { newID, fieldMappings }
        for (const dsData of dataSourcesData) {
            const newInstitutionId = institutionMap.get(dsData.institution);
            if (!newInstitutionId) {
                console.warn(`Institution ID ${dsData.institution} for data source ${dsData.id} not found in map. Skipping.`);
                continue;
            }
            const dsName = `Data source for ${institutionsData.find(i => i.id === dsData.institution)?.name || dsData.institution}`;
            const nameId = await createTextEntry(dsName, 'datasources.name', englishLang.code);
            const methodId = await createTextEntry(dsData.method, 'datasources.method', englishLang.code);

            const [dbDataSource] = await db.insert(dbDatasources).values({
                id: uuidv4(),
                name_id: nameId,
                institution_id: newInstitutionId,
                language: dsData.languages?.[0] || englishLang.code, // Take first language or default
                method_id: methodId,
                date: dsData.date ? new Date(dsData.date) : new Date()
            }).returning();

            const fieldMappings = new Map();
            dsData.fields.forEach(f => {
                if (f.fieldLinks && f.fieldLinks.length > 0) {
                    fieldMappings.set(f.field.toLowerCase(), f.fieldLinks[0].toLowerCase());
                } else {
                    fieldMappings.set(f.field.toLowerCase(), f.field.toLowerCase()); // Fallback if no link
                }
            });
            dataSourceMap.set(dsData.id, { newID: dbDataSource.id, fieldMappings });
        }
        console.log(`${dataSourceMap.size} data sources seeded.`);

        // --- 6. Seed Research Field (Edo Designation) and Vocabularies ---
        const edoRfNameId = await createTextEntry("Edo Designation", 'research_fields.name', englishLang.code);
        const edoRfDescId = await createTextEntry("Vocabulary for Edo designations of objects.", 'research_fields.description', englishLang.code);

        const [edoResearchField] = await db.insert(research_fields).values({
            id: uuidv4(),
            name_id: edoRfNameId,
            description_id: edoRfDescId,
            project_id: projectRecord.id,
            type: 'multiselect'
        }).returning();

        const edoVocabularyMap = new Map(); // Map old Edo ID to new vocabulary DB ID
        for (const edoData of edoDesignationsData) {
            const nameId = await createTextEntry(edoData.name, 'vocabularies.option', englishLang.code);
            const descriptionId = await createTextEntry(edoData.description, 'vocabularies.description', englishLang.code);
            let newAssetId = null;
            if (edoData.asset) {
                // For vocabulary assets from edo_designations.json, specifically look only in the 'edo_images' subfolder.
                const localAssetPath = await findAssetPath(edoData.asset, ['edo_images']);

                if (localAssetPath) {
                    // Asset found in 'edo_images'. It will be imported as project-level (no institution)
                    // and its ID will be linked to the vocabulary's main_asset.
                    const assetInstitutionIdForVocab = null; // Ensures project-level asset
                    console.log(`INFO: Vocabulary asset '${edoData.asset}' found in 'edo_images'. Importing as project-level.`);

                    const assetData = { path: [localAssetPath], isDirectory: false, projectId: projectRecord.id, institutionId: assetInstitutionIdForVocab };
                    try {
                        const importResult = await handleImportAssets(null, assetData);
                        if (importResult && importResult.createdAssets && importResult.createdAssets.length > 0) {
                            newAssetId = importResult.createdAssets[0].id;
                            console.log(`INFO: Asset '${edoData.asset}' imported with ID '${newAssetId}' and will be linked to vocabulary '${edoData.name}'.`);
                        }
                    } catch (e) {
                        console.warn(`Failed to import vocabulary asset ${edoData.asset} from 'edo_images' for Edo Designation ${edoData.name}: ${e.message}`);
                    }
                } else {
                    // Asset specified in edo_designations.json was not found in the 'edo_images' folder.
                    console.warn(`WARNING: Vocabulary asset '${edoData.asset}' for Edo Designation '${edoData.name}' not found in '${path.join(seedDataPath, 'edo_images')}'. It will not be linked.`);
                }
            }

            const [dbVocabulary] = await db.insert(vocabularies).values({
                id: uuidv4(),
                option_id: nameId,
                description_id: descriptionId,
                field_id: edoResearchField.id,
                main_asset: newAssetId
            }).returning();
            edoVocabularyMap.set(edoData.id, dbVocabulary.id);
        }
        console.log(`Edo Designation research field and ${edoDesignationsData.length} vocabularies seeded.`);

        // --- 7. Seed Objects ---
        for (const objData of objectsData) {
            const newInstitutionId = institutionMap.get(objData.institution);
            if (!newInstitutionId) {
                console.warn(`Institution ID ${objData.institution} for object ${objData.id} not found. Skipping.`);
                continue;
            }

            const [dbObject] = await db.insert(dbObjects).values({
                id: uuidv4(), // Generate new UUID for the object
                institution_id: newInstitutionId,
                project_id: projectRecord.id,
                status: 'in progress' // Default status
            }).returning();

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

            // Handle Images
            if (objData.images && objData.images.length > 0) {
                for (const [index, imgData] of objData.images.entries()) {
                    if (imgData.asset) {
                        const localImgPath = await findAssetPath(imgData.asset);
                        if (localImgPath) {
                            const assetData = { path: [localImgPath], isDirectory: false, projectId: projectRecord.id, institutionId: newInstitutionId };
                            try {
                                const importResult = await handleImportAssets(null, assetData);
                                if (importResult && importResult.createdAssets && importResult.createdAssets.length > 0) {
                                    const createdAsset = importResult.createdAssets[0];
                                    await db.insert(objects_assets).values({
                                        id: uuidv4(),
                                        asset_id: createdAsset.id,
                                        object_id: dbObject.id,
                                        order: index + 1
                                    });
                                }
                            } catch (e) {
                                console.warn(`Failed to import image asset ${imgData.asset} for object ${objData.id}: ${e.message}`);
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
                    const { newID: newDataSourceId, fieldMappings } = dsInfo;

                    for (const fieldValuePair of metadataEntry.metadata) {
                        const sourceFieldName = fieldValuePair.field;
                        const ontologyFieldName = fieldMappings.get(sourceFieldName.toLowerCase());

                        if (!ontologyFieldName) {
                            console.warn(`No ontology field mapping for source field '${sourceFieldName}' in object ${objData.id}. Using source field name directly.`);
                        }
                        const targetOntologyFieldName = ontologyFieldName || sourceFieldName.toLowerCase();
                        const ontologyFieldDbId = ontologyFieldsByName.get(targetOntologyFieldName);

                        if (ontologyFieldDbId && fieldValuePair.value !== null && typeof fieldValuePair.value !== "undefined" && String(fieldValuePair.value).trim() !== "") {
                            await db.insert(objects_ontology_fields).values({
                                id: uuidv4(),
                                object_id: dbObject.id,
                                field_id: ontologyFieldDbId,
                                datasources_id: newDataSourceId,
                                label: sourceFieldName, // Store original field name as label
                                value: String(fieldValuePair.value),
                                primary: fieldValuePair.primary ? 1 : 0
                            });
                        } else {
                            if (!ontologyFieldDbId) console.warn(`Ontology field ID for '${targetOntologyFieldName}' not found for object ${objData.id}, field '${sourceFieldName}'.`);
                        }
                    }
                }
            }
        }
        console.log(`${objectsData.length} objects seeded.`);

        console.log('Seed completed successfully!');
    } catch (error) {
        console.error('Error during seeding:', error);
        process.exit(1);
    }
};

seed(); 