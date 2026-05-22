/**
 * Custom GraphQL resolver factories for institutionById related database queries and mutations.
 *
 * @namespace db.customQueries.institutionById
 */
import { sql, eq, aliasedTable } from 'drizzle-orm';
import * as dbSchema from '../schema.js';
import { addCountField, createCountSubquery, createTextFieldWithTranslations, processTranslations } from './common.js';

export const createInstitutionByIdQuery = (db, drizzleResult) => {
    // Add count fields to InstitutionsSelectItem type
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'objectsCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'assetsCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'datasourcesCount');
    addCountField(drizzleResult, 'InstitutionsSelectItem', 'totalCount');

    return {
        name: 'institutionById',
        type: drizzleResult.schema._typeMap.InstitutionsSelectItem,
        args: [
            {
                name: 'institution_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'ID of the institution to retrieve'
            }
        ],
        resolve: async (source, args, context, info) => {
            // Validate input
            if (!args.institution_id) {
                throw new Error('institution_id is required');
            }

            // Create aliases for the texts tables
            const nameTexts = aliasedTable(dbSchema.texts, 'name_texts');
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const locationTexts = aliasedTable(dbSchema.texts, 'location_texts');
            const countryTexts = aliasedTable(dbSchema.texts, 'country_texts');

            // Create aliases for the translations tables
            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');
            const locationTranslations = aliasedTable(dbSchema.translations, 'location_translations');
            const countryTranslations = aliasedTable(dbSchema.translations, 'country_translations');

            // Create aliases for the languages tables
            const nameLanguages = aliasedTable(dbSchema.languages, 'name_languages');
            const descriptionLanguages = aliasedTable(dbSchema.languages, 'description_languages');
            const locationLanguages = aliasedTable(dbSchema.languages, 'location_languages');
            const countryLanguages = aliasedTable(dbSchema.languages, 'country_languages');

            // Create count subqueries
            const objectsSubquery = createCountSubquery(
                db,
                dbSchema.objects,
                'institution_id',
                'objects_count'
            );

            const datasourcesSubquery = createCountSubquery(
                db,
                dbSchema.datasources,
                'institution_id',
                'datasources_count'
            );

            const assetsSubquery = createCountSubquery(
                db,
                dbSchema.assets,
                'institution_id',
                'assets_count'
            );

            // Build the query
            const query = db.select({
                id: dbSchema.institutions.id,
                created_at: dbSchema.institutions.created_at,
                updated_at: dbSchema.institutions.updated_at,
                project_id: dbSchema.institutions.project_id,
                website: dbSchema.institutions.website,
                name: createTextFieldWithTranslations(nameTexts, nameTranslations, nameLanguages),
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations, descriptionLanguages),
                location: createTextFieldWithTranslations(locationTexts, locationTranslations, locationLanguages),
                country: createTextFieldWithTranslations(countryTexts, countryTranslations, countryLanguages),
                status: dbSchema.institutions.status,
                links: dbSchema.institutions.links,
                objectsCount: sql`COALESCE(${objectsSubquery.objects_count}, 0)`.as('objectsCount'),
                datasourcesCount: sql`COALESCE(${datasourcesSubquery.datasources_count}, 0)`.as('datasourcesCount'),
                assetsCount: sql`COALESCE(${assetsSubquery.assets_count}, 0)`.as('assetsCount')
            })
                .from(dbSchema.institutions)
                .where(eq(dbSchema.institutions.id, args.institution_id))
                .leftJoin(objectsSubquery, eq(dbSchema.institutions.id, objectsSubquery.institution_id))
                .leftJoin(datasourcesSubquery, eq(dbSchema.institutions.id, datasourcesSubquery.institution_id))
                .leftJoin(assetsSubquery, eq(dbSchema.institutions.id, assetsSubquery.institution_id))
                .leftJoin(nameTexts, eq(dbSchema.institutions.name_id, nameTexts.id))
                .leftJoin(nameTranslations, eq(nameTexts.id, nameTranslations.text_id))
                .leftJoin(nameLanguages, eq(nameTranslations.language_id, nameLanguages.id))
                .leftJoin(descriptionTexts, eq(dbSchema.institutions.description_id, descriptionTexts.id))
                .leftJoin(descriptionTranslations, eq(descriptionTexts.id, descriptionTranslations.text_id))
                .leftJoin(descriptionLanguages, eq(descriptionTranslations.language_id, descriptionLanguages.id))
                .leftJoin(locationTexts, eq(dbSchema.institutions.location_id, locationTexts.id))
                .leftJoin(locationTranslations, eq(locationTexts.id, locationTranslations.text_id))
                .leftJoin(locationLanguages, eq(locationTranslations.language_id, locationLanguages.id))
                .leftJoin(countryTexts, eq(dbSchema.institutions.country_id, countryTexts.id))
                .leftJoin(countryTranslations, eq(countryTexts.id, countryTranslations.text_id))
                .leftJoin(countryLanguages, eq(countryTranslations.language_id, countryLanguages.id))
                .groupBy(dbSchema.institutions.id);

            // Execute the query
            const institutions = await query.execute();

            // Process the result
            if (institutions.length === 0) {
                return null; // Return null if no institution is found
            }

            // Process translations for the single institution
            const processedInstitutions = processTranslations(institutions, ['name', 'description', 'location', 'country']);

            // Explicitly parse the links JSON for the institution
            if (processedInstitutions[0].links && typeof processedInstitutions[0].links === 'string') {
                try {
                    processedInstitutions[0].links = JSON.parse(processedInstitutions[0].links);
                } catch (e) {
                    console.error(`Error parsing links for institution ${processedInstitutions[0].id}:`, e);
                    processedInstitutions[0].links = [];
                }
            }

            // Return the first (and only) result
            return processedInstitutions[0];
        }
    };
}; 
