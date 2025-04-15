import { db } from './init.js';
import { languages, project, project_languages, institutions, texts, objects, assets, objects_assets, research_fields, vocabularies, objects_research_fields, ontology_fields } from './schema.js';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { handleImportAssets } from '../backend/handlers/assetHandlers.js';

// Configuration constants for seed cardinality
const SEED_CONFIG = {
    INSTITUTIONS_COUNT: 5,              // Number of institutions to create
    OBJECTS_PER_INSTITUTION: 3,         // Number of objects per institution
    RESEARCH_FIELDS_COUNT: 10,           // Total number of research fields
    MULTISELECT_FIELDS_COUNT: 3,         // Number of multiselect research fields (out of total)
    VOCABULARY_OPTIONS_PER_FIED: 3,     // Number of vocabulary options per multiselect field
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

const seed = async () => {
    try {
        // Create temp directory for downloads if it doesn't exist
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Create languages
        const [english, italian] = await Promise.all([
            db.insert(languages).values({
                code: 'en',
                name: 'English'
            }).returning(),
            db.insert(languages).values({
                code: 'it',
                name: 'Italian'
            }).returning()
        ]);

        // Create project texts
        const [titleText, descriptionText] = await Promise.all([
            db.insert(texts).values({
                content: 'Sample Project',
                context: 'project.title',
                original_language: english[0].code
            }).returning(),
            db.insert(texts).values({
                content: 'A sample project for testing',
                context: 'project.description',
                original_language: english[0].code
            }).returning()
        ]);

        // Create project
        const [projectRecord] = await db.insert(project).values({
            title_id: titleText[0].id,
            description_id: descriptionText[0].id
        }).returning();

        // Link languages to project
        await Promise.all([
            db.insert(project_languages).values({
                project_id: projectRecord.id,
                language_code: english[0].code,
                is_default: 1
            }),
            db.insert(project_languages).values({
                project_id: projectRecord.id,
                language_code: italian[0].code,
                is_default: 0
            })
        ]);

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
                original_language: english[0].code
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
                    original_language: english[0].code
                }).returning(),
                db.insert(texts).values({
                    content: field.description,
                    context: 'ontology_fields.description',
                    original_language: english[0].code
                }).returning()
            ]);

            const [ontologyField] = await db.insert(ontology_fields).values({
                name_id: nameText[0].id,
                description_id: descriptionText[0].id,
                category_id: categoryTextEntries[field.category]
            }).returning();

            return ontologyField;
        });

        const ontologyFieldsCreated = await Promise.all(ontologyFieldPromises);
        console.log(`Created ${ontologyFieldsCreated.length} ontology fields`);

        // Create institutions
        const institutionPromises = Array(SEED_CONFIG.INSTITUTIONS_COUNT).fill().map(async (_, i) => {
            const [nameText, descriptionText, countryText, locationText] = await Promise.all([
                db.insert(texts).values({
                    content: `Institution ${i + 1}`,
                    context: 'institutions.name',
                    original_language: english[0].code
                }).returning(),
                db.insert(texts).values({
                    content: `Description for Institution ${i + 1}`,
                    context: 'institutions.description',
                    original_language: english[0].code
                }).returning(),
                db.insert(texts).values({
                    content: 'Italy',
                    context: 'institutions.country',
                    original_language: english[0].code
                }).returning(),
                db.insert(texts).values({
                    content: `Location ${i + 1}`,
                    context: 'institutions.location',
                    original_language: english[0].code
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

            return institution;
        });

        const institutionsList = await Promise.all(institutionPromises);

        // Create research fields (some multiselect, some free text)
        const researchFieldPromises = Array(SEED_CONFIG.RESEARCH_FIELDS_COUNT).fill().map(async (_, i) => {
            const isMultiselect = i < SEED_CONFIG.MULTISELECT_FIELDS_COUNT;
            const [nameText, descriptionText] = await Promise.all([
                db.insert(texts).values({
                    content: `Research Field ${i + 1}`,
                    context: 'research_fields.name',
                    original_language: english[0].code
                }).returning(),
                db.insert(texts).values({
                    content: `Description for Research Field ${i + 1}`,
                    context: 'research_fields.description',
                    original_language: english[0].code
                }).returning()
            ]);

            const [field] = await db.insert(research_fields).values({
                name_id: nameText[0].id,
                description_id: descriptionText[0].id,
                project_id: projectRecord.id,
                type: isMultiselect ? 'multiselect' : 'free_text'
            }).returning();

            // For multiselect fields, create vocabulary options
            if (isMultiselect) {
                const vocabularyPromises = Array(SEED_CONFIG.VOCABULARY_OPTIONS_PER_FIED).fill().map(async (_, j) => {
                    const [optionText, descriptionText] = await Promise.all([
                        db.insert(texts).values({
                            content: `Option ${j + 1} for Field ${i + 1}`,
                            context: 'vocabularies.option',
                            original_language: english[0].code
                        }).returning(),
                        db.insert(texts).values({
                            content: `Description for Option ${j + 1} of Field ${i + 1}`,
                            context: 'vocabularies.description',
                            original_language: english[0].code
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

        // Create objects per institution with assets each
        for (const institution of institutionsList) {
            const objectPromises = Array(SEED_CONFIG.OBJECTS_PER_INSTITUTION).fill().map(async (_, i) => {
                // Create object
                const [object] = await db.insert(objects).values({
                    status: 'in progress',
                    institution_id: institution.id,
                    project_id: projectRecord.id
                }).returning();

                // Create assets for the object
                for (let assetIndex = 0; assetIndex < SEED_CONFIG.ASSETS_PER_OBJECT; assetIndex++) {
                    // Generate placeholder image details
                    const assetText = `Object ${i + 1} from Institution ${institution.id}`;
                    const assetColor = `${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
                    const assetUrl = `https://placehold.co/600x400/${assetColor}/FFFFFF/png?text=${encodeURIComponent(assetText)}`;

                    // Download the placeholder image
                    const tempFilePath = path.join(tempDir, `temp_${object.id}_${assetIndex}.png`);
                    await downloadFile(assetUrl, tempFilePath);

                    // Import the asset using our asset handler
                    const assetData = {
                        path: [tempFilePath], // handleImportAssets expects an array for non-directory imports
                        isDirectory: false,
                        projectId: projectRecord.id,
                        institutionId: institution.id
                    };

                    // Import the asset using our handler
                    await handleImportAssets(null, assetData);

                    // Clean up temp file
                    fs.unlinkSync(tempFilePath);
                }

                // Add research field values
                const researchFieldPromises = researchFieldsList.map(async (field) => {
                    if (field.type === 'multiselect') {
                        const fieldVocabularies = await db.select().from(vocabularies)
                            .where(sql`${vocabularies.field_id} = ${field.id}`)
                            .$dynamic();

                        const randomVocabulary = fieldVocabularies[Math.floor(Math.random() * fieldVocabularies.length)];

                        await db.insert(objects_research_fields).values({
                            id: uuidv4(),
                            object_id: object.id,
                            field_id: field.id,
                            vocabulary_id: randomVocabulary.id,
                            value: null
                        });
                    } else {
                        await db.insert(objects_research_fields).values({
                            id: uuidv4(),
                            object_id: object.id,
                            field_id: field.id,
                            vocabulary_id: null,
                            value: `Free text value for Field ${field.id} on Object ${object.id}`
                        });
                    }
                });

                await Promise.all(researchFieldPromises);

                return object;
            });

            await Promise.all(objectPromises);
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
