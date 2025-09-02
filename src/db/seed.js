import { db } from './init.js';
import {
    languages, project, institutions, texts, objects, assets,
    objects_assets, research_fields, vocabularies, objects_research_fields,
    ontology_fields, datasources, objects_ontology_fields,
} from './schema.js';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { handleImportAssets } from '../backend/handlers/assetHandlers.js';
import { eq } from 'drizzle-orm';

// Configuration constants for seed cardinality
const SEED_CONFIG = {
    INSTITUTIONS_COUNT: 5,              // Number of institutions to create
    OBJECTS_PER_INSTITUTION: 8,         // Number of objects per institution
    RESEARCH_FIELDS_COUNT: 10,           // Total number of research fields
    VOCABULARY_FIELDS_COUNT: 3,         // Number of vocabulary research fields (out of total)
    VOCABULARY_OPTIONS_PER_FIED: 3,     // Number of vocabulary options per vocabulary field
    ASSETS_PER_OBJECT: 1                 // Number of assets per object
};

// Function to download a file from URL
const downloadFile = (url, destPath) => {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            const fileStream = fs.createWriteStream(destPath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve(destPath);
            });

            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => reject(err));
            });
        }).on('error', reject);
    });
};

// --- Realistic Value Sets for Ontology Fields (Using slightly different keys) ---
const REALISTIC_ONTOLOGY_VALUES = [
    { item_designation: "Roman Amphora", obj_type: "Pottery", material_desc: "Terracotta", date_created: "c. 100-200 AD", production_loc: "Gaul", item_condition: "Fragmentary", size_dimensions: "H: 75cm, W: 40cm" },
    { item_designation: "Bronze Fibula", obj_type: "Jewelry", material_desc: "Bronze", date_created: "c. 50 BC - 50 AD", production_loc: "Roman Empire", item_condition: "Good", size_dimensions: "L: 5cm" },
    { item_designation: "Egyptian Scarab Seal", obj_type: "Seal", material_desc: "Steatite", date_created: "New Kingdom, c. 1550-1070 BC", production_loc: "Thebes", item_condition: "Excellent", size_dimensions: "L: 2cm" },
    { item_designation: "Greek Kylix Fragment", obj_type: "Pottery", material_desc: "Ceramic, Red-figure", date_created: "c. 480 BC", production_loc: "Athens", item_condition: "Fragmentary", iconography_desc: "Symposium scene" },
    { item_designation: "Medieval Manuscript Page", obj_type: "Manuscript", material_desc: "Parchment, Ink", date_created: "c. 1300-1350", production_loc: "France", item_condition: "Fair", inscriptions_detail: "Latin text, illuminated initial" },
    { item_designation: "Flint Arrowhead", obj_type: "Tool", material_desc: "Flint", date_created: "Neolithic, c. 4000-2500 BC", production_loc: "Europe (Likely)", item_condition: "Good", size_dimensions: "L: 4cm" },
    { item_designation: "Iron Age Sword Hilt", obj_type: "Weaponry", material_desc: "Iron, Bone", date_created: "c. 800-500 BC", production_loc: "Central Europe", item_condition: "Corroded, Incomplete", size_dimensions: "L: 15cm (hilt)" },
    { item_designation: "Samian Ware Bowl", obj_type: "Pottery", material_desc: "Ceramic (Terra Sigillata)", date_created: "c. 150-250 AD", production_loc: "East Gaul", item_condition: "Good, minor chip", size_dimensions: "Dia: 18cm" },
    { item_designation: "Viking Glass Bead", obj_type: "Jewelry", material_desc: "Glass", date_created: "c. 800-1000 AD", production_loc: "Scandinavia", item_condition: "Excellent", size_dimensions: "Dia: 1cm" },
    { item_designation: "Renaissance Oil Lamp", obj_type: "Household Item", material_desc: "Bronze", date_created: "c. 1550-1600", production_loc: "Italy", item_condition: "Good", item_weight: "Approx. 500g" }
];
// --- End Realistic Values ---

const seed = async () => {
    try {
        // Create temp directory for downloads if it doesn't exist
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Create project first (without text references)
        const [projectRecord] = await db.insert(project).values({
            title_id: null, // Will be updated later
            description_id: null // Will be updated later
        }).returning();

        // Create project-specific languages
        const [english, italian] = await Promise.all([
            db.insert(languages).values({
                project_id: projectRecord.id,
                code: 'en',
                name: 'English',
                is_default: 1
            }).returning(),
            db.insert(languages).values({
                project_id: projectRecord.id,
                code: 'it',
                name: 'Italian',
                is_default: 0
            }).returning()
        ]);

        // Create project texts with correct language references
        const [titleText, descriptionText] = await Promise.all([
            db.insert(texts).values({
                content: 'Sample Project',
                context: 'project.title',
                original_language_id: english[0].id
            }).returning(),
            db.insert(texts).values({
                content: 'A sample project for testing',
                context: 'project.description',
                original_language_id: english[0].id
            }).returning()
        ]);

        // Update project with text references
        await db.update(project)
            .set({
                title_id: titleText[0].id,
                description_id: descriptionText[0].id
            })
            .where(eq(project.id, projectRecord.id));

        // Create ontology field categories
        const categoryMap = {
            "basic": "Basic Information",
            "physical": "Physical Attributes",
            "creation": "Creation Information",
            "history": "Historical Context",
            "acquisition": "Acquisition Details",
            "management": "Collection Management",
            "references": "References & Documentation"
        };

        // Create category text entries
        const categoryTextEntries = {};
        for (const [key, value] of Object.entries(categoryMap)) {
            const categoryText = await db.insert(texts).values({
                content: value,
                context: `ontology.category.${key}`,
                original_language_id: english[0].id
            }).returning();

            // Debug logging to see what's coming back
            console.log(`Category text for ${key}:`, categoryText);

            // Guard against undefined values
            if (categoryText && categoryText.length > 0) {
                categoryTextEntries[key] = categoryText[0].id;
            } else {
                // Create a fallback if the returning() doesn't work as expected
                const insertedText = await db.select().from(texts)
                    .where(sql`${texts.content} = ${value} AND ${texts.context} = ${"ontology.category." + key}`)
                    .limit(1);

                if (insertedText && insertedText.length > 0) {
                    categoryTextEntries[key] = insertedText[0].id;
                    console.log(`Retrieved ${key} category using fallback:`, insertedText[0].id);
                } else {
                    throw new Error(`Failed to create category text for ${key}`);
                }
            }
        }

        // Define ontology fields with categories
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

        // Create ontology fields
        const ontologyFieldPromises = ontologyFieldsList.map(async (field) => {
            const [nameText, descriptionText] = await Promise.all([
                db.insert(texts).values({
                    content: field.name,
                    context: 'ontology_fields.name',
                    original_language_id: english[0].id
                }).returning(),
                db.insert(texts).values({
                    content: field.description,
                    context: 'ontology_fields.description',
                    original_language_id: english[0].id
                }).returning()
            ]);

            // Ensure texts were created
            if (!nameText?.[0]?.id || !descriptionText?.[0]?.id) {
                throw new Error(`Failed to create texts for ontology field '${field.name}'`);
            }

            const [ontologyField] = await db.insert(ontology_fields).values({
                name_id: nameText[0].id,
                description_id: descriptionText[0].id,
                category_id: categoryTextEntries[field.category]
            }).returning();

            if (!ontologyField) {
                throw new Error(`Failed to insert ontology field record for '${field.name}'`);
            }

            // Return both the created field record AND the original name
            return { ...ontologyField, originalName: field.name };
        });

        const ontologyFieldsCreated = await Promise.all(ontologyFieldPromises);
        console.log(`Created ${ontologyFieldsCreated.length} ontology fields`);

        // --- Define Mapping from Realistic Keys to Official Ontology Field Names ---
        const realisticKeyToOntologyNameMap = {
            "item_designation": "designation",
            "obj_type": "object type",
            "material_desc": "material",
            "date_created": "date made",
            "production_loc": "production place",
            "item_condition": "condition",
            "size_dimensions": "dimensions",
            "iconography_desc": "iconography",
            "inscriptions_detail": "inscriptions",
            "item_weight": "weight"
            // Add other mappings here if needed
        };
        // --- End Mapping Definition ---

        // Define Helper Map (ontology name -> ID)
        const ontologyFieldsByName = ontologyFieldsCreated.reduce((map, fieldData) => {
            if (fieldData && fieldData.originalName) {
                map[fieldData.originalName] = fieldData.id;
            } else {
                console.warn("Ontology field created but missing originalName in result:", fieldData);
            }
            return map;
        }, {});
        console.log("Ontology field map created with keys:", Object.keys(ontologyFieldsByName));

        // Create institutions
        const institutionPromises = Array(SEED_CONFIG.INSTITUTIONS_COUNT).fill().map(async (_, i) => {
            const [nameText, descriptionText, countryText, locationText] = await Promise.all([
                db.insert(texts).values({
                    content: `Institution ${i + 1}`,
                    context: 'institutions.name',
                    original_language_id: english[0].id
                }).returning(),
                db.insert(texts).values({
                    content: `Description for Institution ${i + 1}`,
                    context: 'institutions.description',
                    original_language_id: english[0].id
                }).returning(),
                db.insert(texts).values({
                    content: 'Italy',
                    context: 'institutions.country',
                    original_language_id: english[0].id
                }).returning(),
                db.insert(texts).values({
                    content: `Location ${i + 1}`,
                    context: 'institutions.location',
                    original_language_id: english[0].id
                }).returning()
            ]);

            const [institution] = await db.insert(institutions).values({
                name_id: nameText[0].id,
                description_id: descriptionText[0].id,
                country_id: countryText[0].id,
                location_id: locationText[0].id,
                project_id: projectRecord.id,
                status: 'in progress',
                links: JSON.stringify([
                    { url: `https://institution${i + 1}.example.com`, label: `${i + 1} Official Website` },
                    { url: `https://collections.institution${i + 1}.example.com`, label: `${i + 1} Collections` },
                    { url: `https://research.institution${i + 1}.example.com`, label: `${i + 1} Research Portal` }
                ])
            }).returning();

            // --- Create Datasource for the Institution ---
            let datasource = null;
            try {
                const [dsNameText, dsMethodText, dsNotesText] = await Promise.all([
                    db.insert(texts).values({ content: `Institution ${i + 1} Catalog`, context: 'datasources.name', original_language_id: english[0].id }).returning(),
                    db.insert(texts).values({ content: 'Manual Entry', context: 'datasources.method', original_language_id: english[0].id }).returning(),
                    db.insert(texts).values({ content: 'Primary data source for this institution.', context: 'datasources.notes', original_language_id: english[0].id }).returning()
                ]);

                // Check if texts were created successfully
                if (!dsNameText?.[0]?.id || !dsMethodText?.[0]?.id || !dsNotesText?.[0]?.id) {
                    throw new Error(`Failed to create required texts for datasource for Institution ${i + 1}`);
                }

                const insertResult = await db.insert(datasources).values({
                    name_id: dsNameText[0].id,
                    method_id: dsMethodText[0].id,
                    notes_id: dsNotesText[0].id,
                    institution_id: institution.id,
                    language_id: english[0].id,
                    copyright: `© ${new Date().getFullYear()} Institution ${i + 1}`,
                    contact: `curator@institution${i + 1}.example.com`,
                    date: new Date()
                }).returning();

                if (insertResult && insertResult.length > 0) {
                    datasource = insertResult[0];
                    console.log(`Datasource created for Institution ${i + 1}: ${datasource.id}`);
                } else {
                    // If insert returned empty, throw error to stop Promise.all
                    console.error(`Datasource insert command executed for Institution ${i + 1} but no record was returned.`);
                    throw new Error(`Failed to create datasource record for Institution ${i + 1} after insert.`);
                }
            } catch (error) {
                console.error(`Error during datasource/texts creation for Institution ${i + 1}:`, error);
                // Re-throw the error to ensure Promise.all rejects
                throw error;
            }
            // --- End Datasource Creation ---

            // If we reach here, both institution and datasource should be valid
            return { institution, datasource };
        });

        const institutionsAndDatasources = await Promise.all(institutionPromises);
        console.log(`Created ${institutionsAndDatasources.length} institutions and their datasources.`);

        // Create research fields (some vocabulary, some free text)
        const researchFieldPromises = Array(SEED_CONFIG.RESEARCH_FIELDS_COUNT).fill().map(async (_, i) => {
            const isVocabulary = i < SEED_CONFIG.VOCABULARY_FIELDS_COUNT;
            const [nameText, descriptionText] = await Promise.all([
                db.insert(texts).values({
                    content: `Research Field ${i + 1}`,
                    context: 'research_fields.name',
                    original_language_id: english[0].id
                }).returning(),
                db.insert(texts).values({
                    content: `Description for Research Field ${i + 1}`,
                    context: 'research_fields.description',
                    original_language_id: english[0].id
                }).returning()
            ]);

            const [field] = await db.insert(research_fields).values({
                name_id: nameText[0].id,
                description_id: descriptionText[0].id,
                project_id: projectRecord.id,
                type: isVocabulary ? 'vocabulary' : 'free_text'
            }).returning();

            // For vocabulary fields, create vocabulary options
            if (isVocabulary) {
                const vocabularyPromises = Array(SEED_CONFIG.VOCABULARY_OPTIONS_PER_FIED).fill().map(async (_, j) => {
                    const [optionText, descriptionText] = await Promise.all([
                        db.insert(texts).values({
                            content: `Option ${j + 1} for Field ${i + 1}`,
                            context: 'vocabularies.option',
                            original_language_id: english[0].id
                        }).returning(),
                        db.insert(texts).values({
                            content: `Description for Option ${j + 1} of Field ${i + 1}`,
                            context: 'vocabularies.description',
                            original_language_id: english[0].id
                        }).returning()
                    ]);

                    const [vocabulary] = await db.insert(vocabularies).values({
                        option_id: optionText[0].id,
                        description_id: descriptionText[0].id,
                        field_id: field.id
                    }).returning();

                    return vocabulary;
                });

                await Promise.all(vocabularyPromises);
            }

            return field;
        });

        const researchFieldsList = await Promise.all(researchFieldPromises);

        // Create objects per institution with assets and ontology data
        for (const { institution, datasource } of institutionsAndDatasources) {
            const objectPromises = Array(SEED_CONFIG.OBJECTS_PER_INSTITUTION).fill().map(async (_, i) => {
                // Create object
                const [object] = await db.insert(objects).values({ status: 'in progress', institution_id: institution.id, project_id: projectRecord.id }).returning();

                // Create assets for the object
                for (let assetIndex = 0; assetIndex < SEED_CONFIG.ASSETS_PER_OBJECT; assetIndex++) {
                    const assetText = `Object ${i + 1} Inst ${institution.id.substring(0, 4)}`;
                    const assetColor = `${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
                    const assetUrl = `https://placehold.co/600x400/${assetColor}/FFFFFF/png?text=${encodeURIComponent(assetText)}`;
                    const tempFilePath = path.join(tempDir, `temp_${object.id}_${assetIndex}.png`);
                    await downloadFile(assetUrl, tempFilePath);
                    const assetData = { path: [tempFilePath], isDirectory: false, projectId: projectRecord.id, institutionId: institution.id };
                    const importResult = await handleImportAssets(null, assetData);
                    if (importResult.createdAssets && importResult.createdAssets.length > 0) {
                        const createdAsset = importResult.createdAssets[0];
                        await db.insert(objects_assets).values({ id: uuidv4(), asset_id: createdAsset.id, object_id: object.id, order: assetIndex + 1 }).execute();
                    } else {
                        console.warn(`Asset creation failed for object ${object.id}, index ${assetIndex}. Skipping link.`);
                    }
                    fs.unlinkSync(tempFilePath);
                }

                // --- Add Ontology Field Values (using mapping) ---
                console.log(`\n--- Populating Ontology Fields for Object ID: ${object.id} ---`);
                const currentDatasourceId = datasource?.id;
                console.log(`Using Datasource ID: ${currentDatasourceId}`);

                const objectOntologyPromises = [];
                const realisticData = REALISTIC_ONTOLOGY_VALUES[Math.floor(Math.random() * REALISTIC_ONTOLOGY_VALUES.length)];
                console.log(`Selected realistic data set: ${JSON.stringify(realisticData)}`);

                // 1. Add mandatory "object id" field (uses official name directly)
                const objectIdFieldName = 'object id';
                const objectIdFieldId = ontologyFieldsByName[objectIdFieldName];
                console.log(`Lookup for field '${objectIdFieldName}': Found ID = ${objectIdFieldId}`);
                if (objectIdFieldId && currentDatasourceId) {
                    objectOntologyPromises.push(
                        db.insert(objects_ontology_fields).values({
                            id: uuidv4(),
                            object_id: object.id,
                            field_id: objectIdFieldId,
                            value: object.id,
                            label: 'Object Identifier',
                            datasources_id: currentDatasourceId,
                            primary: 1
                        }).catch(e => console.error(`Error inserting mandatory '${objectIdFieldName}' field for object ${object.id}:`, e))
                    );
                } else {
                    console.warn(`Skipping mandatory '${objectIdFieldName}' field. Field ID found: ${!!objectIdFieldId}, Datasource ID found: ${!!currentDatasourceId}`);
                }

                // 2. Add values from the realistic data set using the mapping
                for (const [realisticKey, realisticValue] of Object.entries(realisticData)) {
                    // Map realistic key to official ontology field name
                    const officialOntologyName = realisticKeyToOntologyNameMap[realisticKey];
                    if (!officialOntologyName) {
                        console.warn(`No official ontology name mapping found for realistic key '${realisticKey}'. Skipping.`);
                        continue; // Skip if no mapping exists for this key
                    }

                    // Look up the field ID using the official name
                    const fieldId = ontologyFieldsByName[officialOntologyName];
                    console.log(`Lookup: RealisticKey='${realisticKey}' -> OfficialName='${officialOntologyName}' -> FieldID='${fieldId}', Value='${realisticValue}'`);

                    if (fieldId && realisticValue && currentDatasourceId) {
                        objectOntologyPromises.push(
                            db.insert(objects_ontology_fields).values({
                                id: uuidv4(),
                                object_id: object.id,
                                field_id: fieldId,
                                value: realisticValue,
                                label: realisticKey,
                                datasources_id: currentDatasourceId,
                                primary: 1
                            }).catch(e => console.error(`Error inserting field '${officialOntologyName}' (from key '${realisticKey}') for object ${object.id}:`, e))
                        );
                    } else {
                        console.warn(`Skipping field for realistic key '${realisticKey}'. Official Name found: ${!!officialOntologyName}, Field ID found: ${!!fieldId}, Has value: ${!!realisticValue}, Datasource ID found: ${!!currentDatasourceId}`);
                    }
                }

                try {
                    const results = await Promise.all(objectOntologyPromises);
                    console.log(`Successfully processed ${results.length} ontology field insertions for object ${object.id}.`);
                } catch (error) {
                    console.error(`Error during Promise.all for ontology field insertions for object ${object.id}:`, error);
                }
                console.log(`--- Finished Ontology Fields for Object ID: ${object.id} ---`);
                // --- End Ontology Field Values ---

                // Add research field values
                const researchFieldValuePromises = researchFieldsList.map(async (field) => {
                    if (field.type === 'vocabulary') {
                        const fieldVocabularies = await db.select().from(vocabularies).where(sql`${vocabularies.field_id} = ${field.id}`).$dynamic();
                        if (fieldVocabularies.length > 0) {
                            const randomVocabulary = fieldVocabularies[Math.floor(Math.random() * fieldVocabularies.length)];
                            await db.insert(objects_research_fields).values({ id: uuidv4(), object_id: object.id, field_id: field.id, vocabulary_id: randomVocabulary.id, value: null });
                        } else {
                            // console.warn(...)
                        }
                    } else {
                        await db.insert(objects_research_fields).values({ id: uuidv4(), object_id: object.id, field_id: field.id, vocabulary_id: null, value: `Free text for ${field.id} on Obj ${object.id.substring(0, 4)}` });
                    }
                });
                await Promise.all(researchFieldValuePromises);

                return object;
            });

            await Promise.all(objectPromises);
            console.log(`Created ${SEED_CONFIG.OBJECTS_PER_INSTITUTION} objects for institution ${institution.id} with assets and ontology data.`);
        }

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });

        console.log('Seed completed successfully!');

        // Get the first object for logging (using Drizzle directly)
        const firstObject = await db.select({
            id: objects.id,
            status: objects.status,
            institution_id: objects.institution_id,
            project_id: objects.project_id
        }).from(objects).limit(1);

        if (firstObject.length > 0) {
            console.log('First seeded object:', firstObject[0]);

            // Get research fields for the object (using Drizzle directly)
            const objectResearchFields = await db.select({
                id: objects_research_fields.id,
                value: objects_research_fields.value,
                field_id: objects_research_fields.field_id,
                vocabulary_id: objects_research_fields.vocabulary_id
            })
                .from(objects_research_fields)
                .where(sql`${objects_research_fields.object_id} = ${firstObject[0].id}`);

            console.log(`Found ${objectResearchFields.length} research fields for object`);

            // Get assets for the object (using Drizzle directly)
            const objectAssets = await db.select({
                id: objects_assets.id,
                asset_id: objects_assets.asset_id,
                order: objects_assets.order
            })
                .from(objects_assets)
                .where(sql`${objects_assets.object_id} = ${firstObject[0].id}`);

            console.log(`Found ${objectAssets.length} assets for object`);

            // Get asset details if assets exist
            if (objectAssets.length > 0) {
                const asset = await db.select({
                    id: assets.id,
                    filename: assets.filename,
                    path: assets.path,
                    type: assets.type
                })
                    .from(assets)
                    .where(sql`${assets.id} = ${objectAssets[0].asset_id}`)
                    .limit(1);

                if (asset.length > 0) {
                    console.log('First asset:', asset[0]);
                }
            }
        }
    } catch (error) {
        console.error('Error during seeding:', error);
        throw error;
    }
};

seed();
