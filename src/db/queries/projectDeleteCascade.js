import { promises as fs } from 'fs';
import path from 'path';
import { eq, inArray, or } from 'drizzle-orm';
import { GraphQLBoolean, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import * as dbSchema from '../schema.js';

const normalizeIdList = (values) => {
    if (!Array.isArray(values)) return [];
    return values.filter((value) => typeof value === 'string' && value.trim());
};

const collectTextIds = (...groups) => {
    const ids = new Set();
    groups.flat().forEach((value) => {
        if (typeof value === 'string' && value.trim()) ids.add(value);
    });
    return Array.from(ids);
};

const deleteWhereIn = async (tx, table, column, ids, returningColumn) => {
    if (!ids.length) return [];
    return tx.delete(table).where(inArray(column, ids)).returning(returningColumn).execute();
};

export const createProjectDeleteCascadeMutation = (db, drizzleResult) => {
    const ProjectDeleteCascadeCounts = new GraphQLObjectType({
        name: 'ProjectDeleteCascadeCounts',
        fields: () => ({
            actions: { type: GraphQLInt },
            websiteSettings: { type: GraphQLInt },
            settings: { type: GraphQLInt },
            objects: { type: GraphQLInt },
            assets: { type: GraphQLInt },
            genericAssets: { type: GraphQLInt },
            templates: { type: GraphQLInt },
            institutions: { type: GraphQLInt },
            researchFields: { type: GraphQLInt },
            ontologyFields: { type: GraphQLInt },
            objectDisplayFields: { type: GraphQLInt },
            translations: { type: GraphQLInt },
            texts: { type: GraphQLInt },
            languages: { type: GraphQLInt },
            imports: { type: GraphQLInt },
            project: { type: GraphQLInt }
        })
    });

    const ProjectDeleteCascadePayload = new GraphQLObjectType({
        name: 'ProjectDeleteCascadePayload',
        fields: () => ({
            projectId: { type: GraphQLString },
            deleted: { type: GraphQLBoolean },
            assetsFolderRemoved: { type: GraphQLBoolean },
            assetFolderErrors: { type: new GraphQLList(GraphQLString) },
            counts: { type: ProjectDeleteCascadeCounts }
        })
    });

    drizzleResult.schema._typeMap.ProjectDeleteCascadeCounts = ProjectDeleteCascadeCounts;
    drizzleResult.schema._typeMap.ProjectDeleteCascadePayload = ProjectDeleteCascadePayload;

    return {
        name: 'deleteProjectCascade',
        type: ProjectDeleteCascadePayload,
        args: [
            {
                name: 'projectId',
                type: new GraphQLNonNull(GraphQLString),
                description: 'Project ID to delete along with all related data'
            }
        ],
        resolve: async (source, args) => {
            const projectId = typeof args.projectId === 'string' ? args.projectId.trim() : '';
            if (!projectId) {
                throw new Error('projectId is required');
            }

            const projectRow = await db
                .select({
                    id: dbSchema.project.id,
                    title_id: dbSchema.project.title_id,
                    description_id: dbSchema.project.description_id
                })
                .from(dbSchema.project)
                .where(eq(dbSchema.project.id, projectId))
                .limit(1)
                .execute();

            if (!projectRow.length) {
                return {
                    projectId,
                    deleted: false,
                    assetsFolderRemoved: false,
                    assetFolderErrors: [`Project ${projectId} not found`],
                    counts: {}
                };
            }

            const institutions = await db
                .select({
                    id: dbSchema.institutions.id,
                    name_id: dbSchema.institutions.name_id,
                    description_id: dbSchema.institutions.description_id,
                    country_id: dbSchema.institutions.country_id,
                    location_id: dbSchema.institutions.location_id
                })
                .from(dbSchema.institutions)
                .where(eq(dbSchema.institutions.project_id, projectId))
                .execute();

            const institutionIds = normalizeIdList(institutions.map((row) => row.id));

            const researchFields = await db
                .select({
                    id: dbSchema.research_fields.id,
                    name_id: dbSchema.research_fields.name_id,
                    description_id: dbSchema.research_fields.description_id
                })
                .from(dbSchema.research_fields)
                .where(eq(dbSchema.research_fields.project_id, projectId))
                .execute();

            const researchFieldIds = normalizeIdList(researchFields.map((row) => row.id));

            const ontologyFields = await db
                .select({
                    id: dbSchema.ontology_fields.id,
                    name_id: dbSchema.ontology_fields.name_id,
                    description_id: dbSchema.ontology_fields.description_id,
                    category_id: dbSchema.ontology_fields.category_id
                })
                .from(dbSchema.ontology_fields)
                .where(eq(dbSchema.ontology_fields.project_id, projectId))
                .execute();

            const datasources = institutionIds.length
                ? await db
                    .select({
                        id: dbSchema.datasources.id,
                        import_id: dbSchema.datasources.import_id,
                        name_id: dbSchema.datasources.name_id,
                        method_id: dbSchema.datasources.method_id,
                        notes_id: dbSchema.datasources.notes_id
                    })
                    .from(dbSchema.datasources)
                    .where(inArray(dbSchema.datasources.institution_id, institutionIds))
                    .execute()
                : [];

            const vocabularies = researchFieldIds.length
                ? await db
                    .select({
                        option_id: dbSchema.vocabularies.option_id,
                        description_id: dbSchema.vocabularies.description_id
                    })
                    .from(dbSchema.vocabularies)
                    .where(inArray(dbSchema.vocabularies.field_id, researchFieldIds))
                    .execute()
                : [];

            const websiteSettings = await db
                .select({
                    id: dbSchema.websiteSettings.id,
                    title_id: dbSchema.websiteSettings.title_id,
                    about_id: dbSchema.websiteSettings.about_id
                })
                .from(dbSchema.websiteSettings)
                .where(eq(dbSchema.websiteSettings.project_id, projectId))
                .execute();

            const languages = await db
                .select({ id: dbSchema.languages.id })
                .from(dbSchema.languages)
                .where(eq(dbSchema.languages.project_id, projectId))
                .execute();

            const languageIds = normalizeIdList(languages.map((row) => row.id));
            const importIds = normalizeIdList(datasources.map((row) => row.import_id));

            const textIds = collectTextIds(
                projectRow[0]?.title_id,
                projectRow[0]?.description_id,
                institutions.flatMap((row) => [row.name_id, row.description_id, row.country_id, row.location_id]),
                researchFields.flatMap((row) => [row.name_id, row.description_id]),
                ontologyFields.flatMap((row) => [row.name_id, row.description_id, row.category_id]),
                datasources.flatMap((row) => [row.name_id, row.method_id, row.notes_id]),
                vocabularies.flatMap((row) => [row.option_id, row.description_id]),
                websiteSettings.flatMap((row) => [row.title_id, row.about_id])
            );

            const counts = {
                actions: 0,
                websiteSettings: 0,
                settings: 0,
                objects: 0,
                assets: 0,
                genericAssets: 0,
                templates: 0,
                institutions: 0,
                researchFields: 0,
                ontologyFields: 0,
                objectDisplayFields: 0,
                translations: 0,
                texts: 0,
                languages: 0,
                imports: 0,
                project: 0
            };

            await db.transaction(async (tx) => {
                try {
                    // Break the circular dependency (Project -> Texts -> Languages -> Project)
                    // by nullifying the Project's references to Texts first.
                    await tx.update(dbSchema.project)
                        .set({ title_id: null, description_id: null })
                        .where(eq(dbSchema.project.id, projectId))
                        .execute();

                    // 1. Delete actions first (no dependencies)
                    const deletedActions = await tx
                        .delete(dbSchema.actions)
                        .where(eq(dbSchema.actions.project_id, projectId))
                        .returning({ id: dbSchema.actions.id })
                        .execute();
                    counts.actions = deletedActions.length;

                    // 1b. Delete sync tables (change_log and Yjs tables)
                    await tx
                        .delete(dbSchema.yjs_updates)
                        .where(eq(dbSchema.yjs_updates.project_id, projectId))
                        .execute();

                    await tx
                        .delete(dbSchema.yjs_snapshots)
                        .where(eq(dbSchema.yjs_snapshots.project_id, projectId))
                        .execute();

                    await tx
                        .delete(dbSchema.ingestion_state)
                        .where(eq(dbSchema.ingestion_state.project_id, projectId))
                        .execute();

                    await tx
                        .delete(dbSchema.change_log)
                        .where(eq(dbSchema.change_log.project_id, projectId))
                        .execute();

                    // 2. Delete objects (before assets/institutions since junction tables reference it)
                    const deletedObjects = await tx
                        .delete(dbSchema.objects)
                        .where(eq(dbSchema.objects.project_id, projectId))
                        .returning({ id: dbSchema.objects.id })
                        .execute();
                    counts.objects = deletedObjects.length;

                    // 3. Delete assets (now that objects are gone)
                    const deletedAssets = await tx
                        .delete(dbSchema.assets)
                        .where(eq(dbSchema.assets.project_id, projectId))
                        .returning({ id: dbSchema.assets.id })
                        .execute();
                    counts.assets = deletedAssets.length;

                    // 4. Delete templates
                    const deletedTemplates = await tx
                        .delete(dbSchema.templates)
                        .where(eq(dbSchema.templates.project_id, projectId))
                        .returning({ id: dbSchema.templates.id })
                        .execute();
                    counts.templates = deletedTemplates.length;

                    // 5. Delete institutions (this cascades to datasources)
                    const deletedInstitutions = await tx
                        .delete(dbSchema.institutions)
                        .where(eq(dbSchema.institutions.project_id, projectId))
                        .returning({ id: dbSchema.institutions.id })
                        .execute();
                    counts.institutions = deletedInstitutions.length;

                    // 6. Delete research fields (this cascades to vocabularies)
                    const deletedResearchFields = await tx
                        .delete(dbSchema.research_fields)
                        .where(eq(dbSchema.research_fields.project_id, projectId))
                        .returning({ id: dbSchema.research_fields.id })
                        .execute();
                    counts.researchFields = deletedResearchFields.length;

                    // 7. Delete genericAssets (after research fields/vocabularies)
                    const deletedGenericAssets = await tx
                        .delete(dbSchema.genericAssets)
                        .where(eq(dbSchema.genericAssets.project_id, projectId))
                        .returning({ id: dbSchema.genericAssets.id })
                        .execute();
                    counts.genericAssets = deletedGenericAssets.length;

                    // 8. Delete ontology fields
                    const deletedOntologyFields = await tx
                        .delete(dbSchema.ontology_fields)
                        .where(eq(dbSchema.ontology_fields.project_id, projectId))
                        .returning({ id: dbSchema.ontology_fields.id })
                        .execute();
                    counts.ontologyFields = deletedOntologyFields.length;

                    // 8. Delete object display fields
                    const deletedObjectDisplayFields = await tx
                        .delete(dbSchema.object_display_fields)
                        .where(eq(dbSchema.object_display_fields.project_id, projectId))
                        .returning({ id: dbSchema.object_display_fields.id })
                        .execute();
                    counts.objectDisplayFields = deletedObjectDisplayFields.length;

                    // 9. Delete website settings
                    const deletedWebsiteSettings = await tx
                        .delete(dbSchema.websiteSettings)
                        .where(eq(dbSchema.websiteSettings.project_id, projectId))
                        .returning({ id: dbSchema.websiteSettings.id })
                        .execute();
                    counts.websiteSettings = deletedWebsiteSettings.length;

                    // 10. Delete settings
                    const deletedSettings = await tx
                        .delete(dbSchema.settings)
                        .where(eq(dbSchema.settings.project_id, projectId))
                        .returning({ id: dbSchema.settings.id })
                        .execute();
                    counts.settings = deletedSettings.length;

                    // 11. Delete imports
                    const deletedImports = await deleteWhereIn(
                        tx,
                        dbSchema.imports,
                        dbSchema.imports.id,
                        importIds,
                        { id: dbSchema.imports.id }
                    );
                    counts.imports = deletedImports.length;

                    // 12. Delete translations first
                    if (textIds.length || languageIds.length) {
                        let whereClause = null;
                        if (textIds.length && languageIds.length) {
                            whereClause = or(
                                inArray(dbSchema.translations.text_id, textIds),
                                inArray(dbSchema.translations.language_id, languageIds)
                            );
                        } else if (textIds.length) {
                            whereClause = inArray(dbSchema.translations.text_id, textIds);
                        } else if (languageIds.length) {
                            whereClause = inArray(dbSchema.translations.language_id, languageIds);
                        }

                        if (whereClause) {
                            const deletedTranslations = await tx
                                .delete(dbSchema.translations)
                                .where(whereClause)
                                .returning({ id: dbSchema.translations.id })
                                .execute();
                            counts.translations = deletedTranslations.length;
                        }
                    }

                    // 14. Delete texts (before languages, to remove FK from texts.original_language_id to languages)
                    
                    let textsWhereClause = null;
                    if (textIds.length && languageIds.length) {
                        textsWhereClause = or(
                             inArray(dbSchema.texts.id, textIds),
                             inArray(dbSchema.texts.original_language_id, languageIds)
                        );
                    } else if (textIds.length) {
                         textsWhereClause = inArray(dbSchema.texts.id, textIds);
                    } else if (languageIds.length) {
                         textsWhereClause = inArray(dbSchema.texts.original_language_id, languageIds);
                    }
                    
                    let deletedTextsCount = 0;
                            .where(textsWhereClause)
                            .returning({ id: dbSchema.texts.id })
                         deletedTextsCount = deletedTexts.length;
                    }
                    counts.texts = deletedTextsCount;
                    logDeleteStep('Deleted texts', { count: counts.texts });

                    // 15. Delete languages last (nothing references them anymore)
                        .delete(dbSchema.languages)
                        .where(eq(dbSchema.languages.project_id, projectId))
                        settings: await countByProjectId(tx, dbSchema.settings, projectId)
                    };

                    logDeleteStep('Remaining project_id references before delete', projectRefCounts);

                    logDeleteStep('Deleting project');
                        .where(eq(dbSchema.project.id, projectId))
                        .returning({ id: dbSchema.project.id })
                        .execute();
                    counts.project = deletedProject.length;
                    logDeleteStep('Deleted project', { count: counts.project });
                } catch (error) {
                    console.error('[DELETE CASCADE] Transaction failed:', error);
                    throw error;
                }
            });

            const assetFolderErrors = [];
            let assetsFolderRemoved = false;
            const projectAssetsFolder = path.join(process.cwd(), 'src', 'assets', 'project_assets', projectId);

            try {
                await fs.rm(projectAssetsFolder, { recursive: true, force: true });
                assetsFolderRemoved = true;
            } catch (error) {
                assetFolderErrors.push(error?.message || 'Failed to remove project assets folder');
            }

            return {
                projectId,
                deleted: counts.project > 0,
                assetsFolderRemoved,
                assetFolderErrors,
                counts
            };
        }
    };
};
