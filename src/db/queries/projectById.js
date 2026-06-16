/**
 * Custom GraphQL resolver factories for projectById related database queries and mutations.
 *
 * @namespace db.customQueries.projectById
 */
import { sql, eq, aliasedTable } from 'drizzle-orm';
import * as dbSchema from '../schema.js';
import { addCountField, createCountSubquery, createTextFieldWithTranslations, processTranslations, GraphQLJSON } from './common.js';

export const createProjectByIdQuery = (db, drizzleResult) => {
    // Add count fields to ProjectSelectItem type
    addCountField(drizzleResult, 'ProjectSelectItem', 'institutionsCount');
    addCountField(drizzleResult, 'ProjectSelectItem', 'objectsCount');
    addCountField(drizzleResult, 'ProjectSelectItem', 'assetsCount');
    addCountField(drizzleResult, 'ProjectSelectItem', 'completedObjectsCount');
    addCountField(drizzleResult, 'ProjectSelectItem', 'linkedAssetsCount');
    addCountField(drizzleResult, 'ProjectSelectItem', 'websiteLogoFormats', GraphQLJSON);

    return {
        name: 'projectById',
        type: drizzleResult.schema._typeMap.ProjectSelectItem,
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'ID of the project to retrieve'
            }
        ],
        resolve: async (source, args, context, info) => {
            // Validate input
            if (!args.project_id) {
                throw new Error('project_id is required');
            }

            // Create aliases for the texts, translations, and languages tables
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const titleTexts = aliasedTable(dbSchema.texts, 'title_texts');
            const titleTranslations = aliasedTable(dbSchema.translations, 'title_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');
            const titleLanguages = aliasedTable(dbSchema.languages, 'title_languages');
            const descriptionLanguages = aliasedTable(dbSchema.languages, 'description_languages');

            const websiteSettings = aliasedTable(dbSchema.websiteSettings, 'ws');
            const logoAsset = aliasedTable(dbSchema.genericAssets, 'logo_asset');

            // Create count subqueries
            const institutionsSubquery = createCountSubquery(
                db,
                dbSchema.institutions,
                'project_id',
                'institutions_count'
            );

            const objectsSubquery = createCountSubquery(
                db,
                dbSchema.objects,
                'project_id',
                'objects_count'
            );

            const assetsSubquery = createCountSubquery(
                db,
                dbSchema.assets,
                'project_id',
                'assets_count'
            );

            // Create subquery for completed objects
            const completedObjectsSubquery = db
                .select({
                    project_id: dbSchema.objects.project_id,
                    completed_objects_count: sql`count(*)`.as('completed_objects_count')
                })
                .from(dbSchema.objects)
                .where(eq(dbSchema.objects.status, 'completed'))
                .groupBy(dbSchema.objects.project_id)
                .as('completed_objects_subquery');

            // Create subquery for linked assets (assets that are linked to objects)
            const linkedAssetsSubquery = db
                .select({
                    project_id: dbSchema.assets.project_id,
                    linked_assets_count: sql`count(DISTINCT ${dbSchema.assets.id})`.as('linked_assets_count')
                })
                .from(dbSchema.assets)
                .innerJoin(dbSchema.objects_assets, eq(dbSchema.assets.id, dbSchema.objects_assets.asset_id))
                .groupBy(dbSchema.assets.project_id)
                .as('linked_assets_subquery');

            // Execute the query
            const projects = await db.select({
                id: dbSchema.project.id,
                created_at: dbSchema.project.created_at,
                updated_at: dbSchema.project.updated_at,
                is_shared: dbSchema.project.is_shared,
                password: dbSchema.project.password,
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations, descriptionLanguages),
                title: createTextFieldWithTranslations(titleTexts, titleTranslations, titleLanguages),
                websiteLogoFormats: logoAsset.formats,
                institutionsCount: sql`COALESCE(${institutionsSubquery.institutions_count}, 0)`.as('institutionsCount'),
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount'),
                assetsCount: sql`COALESCE(${assetsSubquery.assets_count}, 0)`.as('assetsCount'),
                completedObjectsCount: sql`COALESCE(${completedObjectsSubquery.completed_objects_count}, 0)`.as('completedObjectsCount'),
                linkedAssetsCount: sql`COALESCE(${linkedAssetsSubquery.linked_assets_count}, 0)`.as('linkedAssetsCount')
            })
                .from(dbSchema.project)
                .where(eq(dbSchema.project.id, args.project_id))
                .leftJoin(descriptionTexts, eq(dbSchema.project.description_id, descriptionTexts.id))
                .leftJoin(descriptionTranslations, eq(descriptionTexts.id, descriptionTranslations.text_id))
                .leftJoin(descriptionLanguages, eq(descriptionTranslations.language_id, descriptionLanguages.id))
                .leftJoin(titleTexts, eq(dbSchema.project.title_id, titleTexts.id))
                .leftJoin(titleTranslations, eq(titleTexts.id, titleTranslations.text_id))
                .leftJoin(titleLanguages, eq(titleTranslations.language_id, titleLanguages.id))
                .leftJoin(websiteSettings, eq(dbSchema.project.id, websiteSettings.project_id))
                .leftJoin(logoAsset, eq(websiteSettings.logo_id, logoAsset.id))
                .leftJoin(institutionsSubquery, eq(dbSchema.project.id, institutionsSubquery.project_id))
                .leftJoin(objectsSubquery, eq(dbSchema.project.id, objectsSubquery.project_id))
                .leftJoin(assetsSubquery, eq(dbSchema.project.id, assetsSubquery.project_id))
                .leftJoin(completedObjectsSubquery, eq(dbSchema.project.id, completedObjectsSubquery.project_id))
                .leftJoin(linkedAssetsSubquery, eq(dbSchema.project.id, linkedAssetsSubquery.project_id))
                .groupBy(dbSchema.project.id)
                .execute();

            // Process the result
            if (projects.length === 0) {
                return null; // Return null if no project is found
            }

            // Process translations for the single project
            const processedProjects = processTranslations(projects, ['title', 'description']);

            // Return the first (and only) result
            return processedProjects[0];
        }
    };
}; 
