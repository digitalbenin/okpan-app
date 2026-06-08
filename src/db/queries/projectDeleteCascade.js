/**
 * Custom GraphQL resolver factories for projectDeleteCascade related database queries and mutations.
 *
 * @namespace db.customQueries.projectDeleteCascade
 */
import { promises as fs } from 'fs';
import path from 'path';
import { eq, inArray, or } from 'drizzle-orm';
import { GraphQLBoolean, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import * as dbSchema from '../schema.js';
import { stopP2PForProject } from '../../backend/services/p2pService.js';
import { clearCurrentProjectId, disposeProjectDoc, getCurrentProjectId } from '../../backend/services/projectCacheService.js';
import { deleteProjectRecoverySnapshots } from '../../backend/services/recoverySnapshotService.js';
import { resolveProjectAssetPath } from '../../backend/utils/assetPaths.js';

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
            snapshotsFolderRemoved: { type: GraphQLBoolean },
            assetFolderErrors: { type: new GraphQLList(GraphQLString) },
            snapshotFolderErrors: { type: new GraphQLList(GraphQLString) },
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
                    is_shared: dbSchema.project.is_shared,
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
                    snapshotsFolderRemoved: false,
                    assetFolderErrors: [`Project ${projectId} not found`],
                    snapshotFolderErrors: [],
                    counts: {}
                };
            }

            const row = projectRow[0];
            const sharedProject = row != null && (row.is_shared === 1 || row.is_shared === true);

            // Shared project deletion must stay local.
            // Stop transport/tailer linkage first so the local cascade cannot be projected back into Yjs and propagated.
            if (sharedProject) {
                try {
                    await stopP2PForProject(projectId);
                } catch (error) {
                    console.warn('[DELETE CASCADE] Failed to stop P2P before deleting shared project:', error);
                }

                if (getCurrentProjectId() === projectId) {
                    clearCurrentProjectId();
                }

                disposeProjectDoc(projectId);
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

            const genericAssets = await db
                .select({ id: dbSchema.genericAssets.id })
                .from(dbSchema.genericAssets)
                .where(eq(dbSchema.genericAssets.project_id, projectId))
                .execute();
            const genericAssetIds = normalizeIdList(genericAssets.map((row) => row.id));

            const objects = await db
                .select({ id: dbSchema.objects.id })
                .from(dbSchema.objects)
                .where(eq(dbSchema.objects.project_id, projectId))
                .execute();
            const objectIds = normalizeIdList(objects.map((row) => row.id));

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

                    // 0. Delete junction/child tables first to avoid FK violations
                    console.log('[DELETE CASCADE] Deleting junction tables...');

                    if (institutionIds.length > 0) {
                        await tx.delete(dbSchema.project_activity)
                            .where(inArray(dbSchema.project_activity.institution_id, institutionIds))
                            .execute();
                    }

                    if (objectIds.length > 0) {
                        await tx.delete(dbSchema.objects_ontology_fields)
                            .where(inArray(dbSchema.objects_ontology_fields.object_id, objectIds))
                            .execute();

                        await tx.delete(dbSchema.objects_research_fields)
                            .where(inArray(dbSchema.objects_research_fields.object_id, objectIds))
                            .execute();

                        await tx.delete(dbSchema.objects_assets)
                            .where(inArray(dbSchema.objects_assets.object_id, objectIds))
                            .execute();

                        await tx.delete(dbSchema.objects_datasources)
                            .where(inArray(dbSchema.objects_datasources.object_id, objectIds))
                            .execute();
                    }

                    if (institutionIds.length > 0) {
                        await tx.delete(dbSchema.assets_institutions)
                            .where(inArray(dbSchema.assets_institutions.institution_id, institutionIds))
                            .execute();
                    }

                    if (researchFieldIds.length > 0) {
                        await tx.delete(dbSchema.vocabularies_generic_assets)
                            .where(inArray(dbSchema.vocabularies_generic_assets.vocabulary_id,
                                tx.select({ id: dbSchema.vocabularies.id })
                                    .from(dbSchema.vocabularies)
                                    .where(inArray(dbSchema.vocabularies.field_id, researchFieldIds))
                            ))
                            .execute();
                    }

                    if (genericAssetIds.length > 0) {
                        await tx.delete(dbSchema.vocabularies_generic_assets)
                            .where(inArray(dbSchema.vocabularies_generic_assets.generic_asset_id, genericAssetIds))
                            .execute();
                    }

                    console.log('[DELETE CASCADE] Junction tables deleted.');

                    // 1. Delete sync tables (change_log and Yjs tables)
                    console.log('[CASCADE] step 1: sync tables...');
                    await tx.delete(dbSchema.yjs_updates).where(eq(dbSchema.yjs_updates.project_id, projectId)).execute();
                    await tx.delete(dbSchema.yjs_snapshots).where(eq(dbSchema.yjs_snapshots.project_id, projectId)).execute();
                    await tx.delete(dbSchema.ingestion_state).where(eq(dbSchema.ingestion_state.project_id, projectId)).execute();
                    await tx.delete(dbSchema.change_log).where(eq(dbSchema.change_log.project_id, projectId)).execute();
                    console.log('[CASCADE] step 1: done');

                    // 2. Delete objects
                    console.log('[CASCADE] step 2: objects...');
                    const deletedObjects = await tx.delete(dbSchema.objects).where(eq(dbSchema.objects.project_id, projectId)).returning({ id: dbSchema.objects.id }).execute();
                    counts.objects = deletedObjects.length;
                    console.log('[CASCADE] step 2: done', deletedObjects.length);

                    // 3. Delete assets
                    console.log('[CASCADE] step 3: assets...');
                    const deletedAssets = await tx.delete(dbSchema.assets).where(eq(dbSchema.assets.project_id, projectId)).returning({ id: dbSchema.assets.id }).execute();
                    counts.assets = deletedAssets.length;
                    console.log('[CASCADE] step 3: done', deletedAssets.length);

                    // 4. Delete templates
                    console.log('[CASCADE] step 4: templates...');
                    const deletedTemplates = await tx.delete(dbSchema.templates).where(eq(dbSchema.templates.project_id, projectId)).returning({ id: dbSchema.templates.id }).execute();
                    counts.templates = deletedTemplates.length;
                    console.log('[CASCADE] step 4: done', deletedTemplates.length);

                    // 4b. Delete datasources
                    if (institutionIds.length > 0) {
                        console.log('[CASCADE] step 4b: datasources...');
                        await tx.delete(dbSchema.datasources).where(inArray(dbSchema.datasources.institution_id, institutionIds)).execute();
                        console.log('[CASCADE] step 4b: done');
                    }

                    // 5. Delete institutions
                    console.log('[CASCADE] step 5: institutions...');
                    const deletedInstitutions = await tx.delete(dbSchema.institutions).where(eq(dbSchema.institutions.project_id, projectId)).returning({ id: dbSchema.institutions.id }).execute();
                    counts.institutions = deletedInstitutions.length;
                    console.log('[CASCADE] step 5: done', deletedInstitutions.length);

                    // 5b. Delete vocabularies
                    if (researchFieldIds.length > 0) {
                        console.log('[CASCADE] step 5b: vocabularies by field...');
                        await tx.delete(dbSchema.vocabularies).where(inArray(dbSchema.vocabularies.field_id, researchFieldIds)).execute();
                        console.log('[CASCADE] step 5b: done');
                    }
                    if (genericAssetIds.length > 0) {
                        console.log('[CASCADE] step 5b: vocabularies by main_asset...');
                        await tx.delete(dbSchema.vocabularies).where(inArray(dbSchema.vocabularies.main_asset_id, genericAssetIds)).execute();
                        console.log('[CASCADE] step 5b: done');
                    }

                    // 6. Delete research fields
                    console.log('[CASCADE] step 6: research_fields...');
                    const deletedResearchFields = await tx.delete(dbSchema.research_fields).where(eq(dbSchema.research_fields.project_id, projectId)).returning({ id: dbSchema.research_fields.id }).execute();
                    counts.researchFields = deletedResearchFields.length;
                    console.log('[CASCADE] step 6: done', deletedResearchFields.length);

                    // 7. Delete website settings (before genericAssets: logo_id FK)
                    console.log('[CASCADE] step 7: website_settings...');
                    const deletedWebsiteSettings = await tx.delete(dbSchema.websiteSettings).where(eq(dbSchema.websiteSettings.project_id, projectId)).returning({ id: dbSchema.websiteSettings.id }).execute();
                    counts.websiteSettings = deletedWebsiteSettings.length;
                    console.log('[CASCADE] step 7: done', deletedWebsiteSettings.length);

                    // 8. Delete genericAssets
                    console.log('[CASCADE] step 8: generic_assets...');
                    const deletedGenericAssets = await tx.delete(dbSchema.genericAssets).where(eq(dbSchema.genericAssets.project_id, projectId)).returning({ id: dbSchema.genericAssets.id }).execute();
                    counts.genericAssets = deletedGenericAssets.length;
                    console.log('[CASCADE] step 8: done', deletedGenericAssets.length);

                    // 9. Delete ontology fields
                    console.log('[CASCADE] step 9: ontology_fields...');
                    const deletedOntologyFields = await tx.delete(dbSchema.ontology_fields).where(eq(dbSchema.ontology_fields.project_id, projectId)).returning({ id: dbSchema.ontology_fields.id }).execute();
                    counts.ontologyFields = deletedOntologyFields.length;
                    console.log('[CASCADE] step 9: done', deletedOntologyFields.length);

                    // 10. Delete object display fields
                    console.log('[CASCADE] step 10: object_display_fields...');
                    const deletedObjectDisplayFields = await tx.delete(dbSchema.object_display_fields).where(eq(dbSchema.object_display_fields.project_id, projectId)).returning({ id: dbSchema.object_display_fields.id }).execute();
                    counts.objectDisplayFields = deletedObjectDisplayFields.length;
                    console.log('[CASCADE] step 10: done', deletedObjectDisplayFields.length);

                    // 11. Delete settings
                    console.log('[CASCADE] step 11: settings...');
                    const deletedSettings = await tx.delete(dbSchema.settings).where(eq(dbSchema.settings.project_id, projectId)).returning({ id: dbSchema.settings.id }).execute();
                    counts.settings = deletedSettings.length;
                    console.log('[CASCADE] step 11: done', deletedSettings.length);

                    // 12. Delete imports
                    console.log('[CASCADE] step 12: imports...');
                    const deletedImports = await deleteWhereIn(tx, dbSchema.imports, dbSchema.imports.id, importIds, { id: dbSchema.imports.id });
                    counts.imports = deletedImports.length;
                    console.log('[CASCADE] step 12: done', deletedImports.length);

                    // 13. Delete translations
                    console.log('[CASCADE] step 13: translations...');
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

                    console.log('[CASCADE] step 13: done', counts.translations);

                    // 14. Delete texts
                    console.log('[CASCADE] step 14: texts...');
                    
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
                    if (textsWhereClause) {
                        const deletedTexts = await tx
                            .delete(dbSchema.texts)
                            .where(textsWhereClause)
                            .returning({ id: dbSchema.texts.id })
                            .execute();
                        deletedTextsCount = deletedTexts.length;
                    }
                    counts.texts = deletedTextsCount;
                    console.log('[CASCADE] step 14: done', deletedTextsCount);

                    // 15. Delete languages
                    console.log('[CASCADE] step 15: languages...');
                    const deletedLanguages = await tx.delete(dbSchema.languages).where(eq(dbSchema.languages.project_id, projectId)).returning({ id: dbSchema.languages.id }).execute();
                    counts.languages = deletedLanguages.length;
                    console.log('[CASCADE] step 15: done', deletedLanguages.length);

                    // 16. Delete the project
                    console.log('[CASCADE] step 16: project...');
                    const deletedProject = await tx
                        .delete(dbSchema.project)
                        .where(eq(dbSchema.project.id, projectId))
                        .returning({ id: dbSchema.project.id })
                        .execute();
                    counts.project = deletedProject.length;
                    console.log('[CASCADE] step 16: done', deletedProject.length);
                } catch (error) {
                    console.error('[DELETE CASCADE] Transaction failed at last step:', error);
                    throw error;
                }
            });

            const assetFolderErrors = [];
            const snapshotFolderErrors = [];
            let assetsFolderRemoved = false;
            let snapshotsFolderRemoved = false;
            const projectAssetsFolder = resolveProjectAssetPath(projectId);

            try {
                await fs.rm(projectAssetsFolder, { recursive: true, force: true });
                assetsFolderRemoved = true;
            } catch (error) {
                assetFolderErrors.push(error?.message || 'Failed to remove project assets folder');
            }

            try {
                await deleteProjectRecoverySnapshots(projectId);
                snapshotsFolderRemoved = true;
            } catch (error) {
                snapshotFolderErrors.push(error?.message || 'Failed to remove project recovery snapshots folder');
            }

            return {
                projectId,
                deleted: counts.project > 0,
                assetsFolderRemoved,
                snapshotsFolderRemoved,
                assetFolderErrors,
                snapshotFolderErrors,
                counts
            };
        }
    };
};

