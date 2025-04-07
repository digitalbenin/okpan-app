import { db } from './init.js';
import { languages, project, project_languages, institutions, texts, objects, assets, objects_assets, research_fields, vocabularies, objects_research_fields } from './schema.js';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { handleImportAssets } from '../backend/handlers/assetHandlers.js';

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

        // Create 10 institutions
        const institutionPromises = Array(10).fill().map(async (_, i) => {
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
                project_id: projectRecord.id
            }).returning();

            return institution;
        });

        const institutionsList = await Promise.all(institutionPromises);

        // Create 10 research fields (3 multiselect, 7 free text)
        const researchFieldPromises = Array(10).fill().map(async (_, i) => {
            const isMultiselect = i < 3;
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

            // For multiselect fields, create 3 vocabulary options
            if (isMultiselect) {
                const vocabularyPromises = Array(3).fill().map(async (_, j) => {
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

        // Create 10 objects per institution with 1 asset each
        for (const institution of institutionsList) {
            const objectPromises = Array(10).fill().map(async (_, i) => {
                // Create object
                const [object] = await db.insert(objects).values({
                    status: 'active',
                    institution_id: institution.id,
                    project_id: projectRecord.id
                }).returning();

                // Generate placeholder image details
                const assetText = `Object ${i + 1} from Institution ${institution.id}`;
                const assetColor = `${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
                const assetUrl = `https://placehold.co/600x400/${assetColor}/FFFFFF/png?text=${encodeURIComponent(assetText)}`;

                // Download the placeholder image
                const tempFilePath = path.join(tempDir, `temp_${object.id}.png`);
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

        // Test query to verify the data structure
        const testQuery = `query GetObject($objectId: String!) {
            result: objects(where: { id: { eq: $objectId } }) {
                id
                status
                created_at
                updated_at
                institution_id
                project_id
                institution {
                    id
                    name {
                        content
                    }
                }
                project {
                    id
                    title {
                        content
                    }
                }
                objectsResearchFields {
                    id
                    value
                    vocabulary_id
                    researchField {
                        id
                        name {
                            content
                        }
                        type
                    }
                    vocabulary {
                        id
                        option {
                            content
                        }
                        description {
                            content
                        }
                    }
                }
                objectsOntologyFields {
                    id
                    label
                    value
                    field_id
                    primary
                    ontologyField {
                        id
                        name {
                            content
                        }
                        category {
                            content
                        }
                    }
                }
                objectsAssets {
                    id
                    order
                    asset {
                        id
                        filename
                        path
                        type
                    }
                }
            }
        }`;

        // Get the first object to test
        const firstObject = await db.select().from(objects).limit(1);
        if (firstObject.length > 0) {
            const result = await window.api.executeGraphQL(testQuery, { objectId: firstObject[0].id });
            console.log('Test query result:', JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.error('Error during seeding:', error);
        throw error;
    }
};

seed();
