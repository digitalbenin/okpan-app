import { sql, eq, aliasedTable, isNotNull } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema';
import { addCountField, createCountSubquery, createTextFieldWithTranslations, processTranslations } from './common';

export const createProjectsListQuery = (db, drizzleResult) => {
    // Add count fields to ProjectSelectItem type
    addCountField(drizzleResult, 'ProjectSelectItem', 'institutionsCount');
    addCountField(drizzleResult, 'ProjectSelectItem', 'objectsCount');
    addCountField(drizzleResult, 'ProjectSelectItem', 'assetsCount');

    return {
        name: 'projectsList',
        type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.ProjectSelectItem)),
        args: [],
        resolve: async (source, args, context, info) => {
            // Create aliases for the texts, translations, and languages tables
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const titleTexts = aliasedTable(dbSchema.texts, 'title_texts');
            const titleTranslations = aliasedTable(dbSchema.translations, 'title_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');
            const titleLanguages = aliasedTable(dbSchema.languages, 'title_languages');
            const descriptionLanguages = aliasedTable(dbSchema.languages, 'description_languages');

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

            // Execute the query
            const projects = await db.select({
                id: dbSchema.project.id,
                created_at: dbSchema.project.created_at,
                updated_at: dbSchema.project.updated_at,
                is_shared: dbSchema.project.is_shared,
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations, descriptionLanguages),
                title: createTextFieldWithTranslations(titleTexts, titleTranslations, titleLanguages),
                institutionsCount: sql`COALESCE(${institutionsSubquery.institutions_count}, 0)`.as('institutionsCount'),
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount'),
                assetsCount: sql`COALESCE(${assetsSubquery.assets_count}, 0)`.as('assetsCount')
            })
                .from(dbSchema.project)
                .where(isNotNull(dbSchema.project.title_id))
                .leftJoin(descriptionTexts, eq(dbSchema.project.description_id, descriptionTexts.id))
                .leftJoin(descriptionTranslations, eq(descriptionTexts.id, descriptionTranslations.text_id))
                .leftJoin(descriptionLanguages, eq(descriptionTranslations.language_id, descriptionLanguages.id))
                .leftJoin(titleTexts, eq(dbSchema.project.title_id, titleTexts.id))
                .leftJoin(titleTranslations, eq(titleTexts.id, titleTranslations.text_id))
                .leftJoin(titleLanguages, eq(titleTranslations.language_id, titleLanguages.id))
                .leftJoin(institutionsSubquery, eq(dbSchema.project.id, institutionsSubquery.project_id))
                .leftJoin(objectsSubquery, eq(dbSchema.project.id, objectsSubquery.project_id))
                .leftJoin(assetsSubquery, eq(dbSchema.project.id, assetsSubquery.project_id))
                .groupBy(dbSchema.project.id)
                .execute();

            // Process translations
            return processTranslations(projects, ['title', 'description']);
        }
    };
}; 