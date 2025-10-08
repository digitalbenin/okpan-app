import { eq } from 'drizzle-orm';
import { GraphQLObjectType, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define a result type for the mutation
export const createProjectCreateMutation = (db, drizzleResult) => {
    const ProjectCreateResult = new GraphQLObjectType({
        name: 'ProjectCreateResult',
        fields: () => ({
            project: { type: drizzleResult.schema._typeMap.ProjectSelectItem },
            defaultLanguage: { type: drizzleResult.schema._typeMap.LanguagesSelectItem },
            titleText: { type: drizzleResult.schema._typeMap.TextsSelectItem },
            descriptionText: { type: drizzleResult.schema._typeMap.TextsSelectItem },
            ontologyFieldsCreated: { type: drizzleResult.schema._typeMap.Int }
        })
    });

    // Register the type in the schema map
    drizzleResult.schema._typeMap.ProjectCreateResult = ProjectCreateResult;

    return {
        name: 'createProjectWithDefaults',
        type: new GraphQLNonNull(ProjectCreateResult),
        args: [
            { name: 'title', type: new GraphQLNonNull(drizzleResult.schema._typeMap.String) },
            { name: 'description', type: drizzleResult.schema._typeMap.String },
            { name: 'languageCode', type: new GraphQLNonNull(drizzleResult.schema._typeMap.String) },
            { name: 'languageName', type: drizzleResult.schema._typeMap.String }
        ],
        resolve: async (source, args, context) => {
            const { title, description, languageCode } = args;
            const languageName = args.languageName || args.languageCode;

            // Preventive logs
            console.log('[PROJECT_CREATE] Init', { title, descriptionLength: description?.length || 0, languageCode, languageName });

            try {
                // Embedding initialization removed to prevent sharp module load issues

                const result = await db.transaction(async (tx) => {
                    // 1) Create project shell
                    const [projectInserted] = await tx.insert(dbSchema.project)
                        .values({})
                        .returning();
                    console.log('[PROJECT_CREATE] Project inserted', { projectId: projectInserted.id });

                    // 2) Create default language
                    const [languageInserted] = await tx.insert(dbSchema.languages)
                        .values({
                            project_id: projectInserted.id,
                            code: languageCode,
                            name: languageName,
                            is_default: 1
                        })
                        .returning();
                    console.log('[PROJECT_CREATE] Language inserted', { languageId: languageInserted.id, code: languageCode });

                    // 3) Create title and description texts
                    const [titleTextInserted] = await tx.insert(dbSchema.texts)
                        .values({
                            content: title,
                            context: 'project.title',
                            original_language_id: languageInserted.id
                        })
                        .returning();
                    console.log('[PROJECT_CREATE] Title text inserted', { textId: titleTextInserted.id });

                    let descriptionTextInserted = null;
                    if (description && description.trim().length > 0) {
                        [descriptionTextInserted] = await tx.insert(dbSchema.texts)
                            .values({
                                content: description,
                                context: 'project.description',
                                original_language_id: languageInserted.id
                            })
                            .returning();
                        console.log('[PROJECT_CREATE] Description text inserted', { textId: descriptionTextInserted.id });
                    }

                    // 4) Link texts to project
                    await tx.update(dbSchema.project)
                        .set({
                            title_id: titleTextInserted.id,
                            description_id: descriptionTextInserted ? descriptionTextInserted.id : null
                        })
                        .where(eq(dbSchema.project.id, projectInserted.id))
                        .execute();
                    console.log('[PROJECT_CREATE] Project updated with text IDs');

                    // 5) Seed ontology fields (explicit absolute path)
                    const resolvedJsonPath = path.join(__dirname, '../src/db/default_ontology_fields.json');
                    console.log(resolvedJsonPath);
                    let seedData;
                    try {
                        if (!fs.existsSync(resolvedJsonPath)) {
                            console.error('[PROJECT_CREATE] Ontology seed file not found', { path: resolvedJsonPath });
                            throw new Error('Ontology seed file missing at specified path');
                        }
                        const jsonContent = fs.readFileSync(resolvedJsonPath, 'utf8');
                        seedData = JSON.parse(jsonContent);
                        console.log('[PROJECT_CREATE] Ontology seed loaded', { path: resolvedJsonPath });
                    } catch (e) {
                        console.error('[PROJECT_CREATE] Failed to load ontology seed', { path: resolvedJsonPath, error: e.message });
                        throw new Error('Failed to load default ontology fields configuration');
                    }

                    const { categories = {}, fields = [] } = seedData || {};

                    // Create category text entries
                    const categoryTextIds = {};
                    for (const [key, value] of Object.entries(categories)) {
                        const [categoryText] = await tx.insert(dbSchema.texts)
                            .values({
                                content: value,
                                context: `ontology.category.${key}`,
                                original_language_id: languageInserted.id
                            })
                            .returning();
                        categoryTextIds[key] = categoryText.id;
                    }
                    console.log('[PROJECT_CREATE] Category texts created', { count: Object.keys(categoryTextIds).length });

                    // Create ontology fields (compute embeddings when available)
                    let createdCount = 0;
                    for (const field of fields) {
                        try {
                            const [nameText] = await tx.insert(dbSchema.texts)
                                .values({
                                    content: field.name,
                                    context: 'ontology_fields.name',
                                    original_language_id: languageInserted.id
                                })
                                .returning();

                            const [descriptionText] = await tx.insert(dbSchema.texts)
                                .values({
                                    content: field.description,
                                    context: 'ontology_fields.description',
                                    original_language_id: languageInserted.id
                                })
                                .returning();

                            await tx.insert(dbSchema.ontology_fields)
                                .values({
                                    name_id: nameText.id,
                                    description_id: descriptionText.id,
                                    category_id: categoryTextIds[field.category] || null,
                                    project_id: projectInserted.id,
                                    embeddings: null,
                                    onwebsite: 1
                                })
                                .execute();

                            createdCount += 1;
                        } catch (fieldErr) {
                            console.error('[PROJECT_CREATE] Failed to create ontology field', { field, error: fieldErr.message });
                            throw fieldErr;
                        }
                    }
                    console.log('[PROJECT_CREATE] Ontology fields seeded', { createdCount });

                    // Build result
                    return {
                        project: projectInserted,
                        defaultLanguage: languageInserted,
                        titleText: titleTextInserted,
                        descriptionText: descriptionTextInserted,
                        ontologyFieldsCreated: createdCount
                    };
                });

                console.log('[PROJECT_CREATE] Completed successfully');
                return result;
            } catch (error) {
                console.error('[PROJECT_CREATE] Error', { message: error.message, stack: error.stack });
                throw new Error(`Project creation failed: ${error.message}`);
            }
        }
    };
};