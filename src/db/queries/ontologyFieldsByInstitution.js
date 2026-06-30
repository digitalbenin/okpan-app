/**
 * Custom GraphQL resolver for fetching ontology fields used by a specific institution.
 *
 * Returns distinct ontology fields that have been used at least once
 * in objects_ontology_fields linked to datasources belonging to the given institution.
 *
 * @namespace db.customQueries.ontologyFieldsByInstitution
 */
import { eq, and, inArray, aliasedTable } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema.js';
import { createTextFieldWithTranslations, processTranslations } from './common.js';

export const createOntologyFieldsByInstitutionQuery = (db, drizzleResult) => {
    // Derive the ontology field type from the auto-generated query field
    const ontologyFieldType = drizzleResult.schema._typeMap.Query._fields.ontology_fields.type
        .ofType  // NonNull → List
        .ofType  // List → NonNull
        .ofType; // NonNull → Ontology_fieldsSelectItem

    return {
        name: 'ontologyFieldsByInstitution',
        type: new GraphQLList(ontologyFieldType),
        args: [
            {
                name: 'projectId',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.String)
            },
            {
                name: 'institutionId',
                type: new GraphQLNonNull(drizzleResult.schema._typeMap.String)
            }
        ],
        resolve: async (source, args) => {
            const { projectId, institutionId } = args;

            // Get distinct field IDs used by this institution's datasources
            const usedFieldRows = await db
                .selectDistinct({ fieldId: dbSchema.objects_ontology_fields.field_id })
                .from(dbSchema.objects_ontology_fields)
                .innerJoin(
                    dbSchema.datasources,
                    eq(dbSchema.objects_ontology_fields.datasources_id, dbSchema.datasources.id)
                )
                .where(eq(dbSchema.datasources.institution_id, institutionId))
                .execute();

            const fieldIds = usedFieldRows.map(r => r.fieldId).filter(Boolean);
            if (fieldIds.length === 0) return [];

            // Aliased tables for text fields
            const nameTexts = aliasedTable(dbSchema.texts, 'name_texts');
            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const descriptionTexts = aliasedTable(dbSchema.texts, 'description_texts');
            const descriptionTranslations = aliasedTable(dbSchema.translations, 'description_translations');
            const categoryTexts = aliasedTable(dbSchema.texts, 'category_texts');
            const categoryTranslations = aliasedTable(dbSchema.translations, 'category_translations');

            const query = db.select({
                id: dbSchema.ontology_fields.id,
                created_at: dbSchema.ontology_fields.created_at,
                updated_at: dbSchema.ontology_fields.updated_at,
                project_id: dbSchema.ontology_fields.project_id,
                embeddings: dbSchema.ontology_fields.embeddings,
                onwebsite: dbSchema.ontology_fields.onwebsite,
                name: createTextFieldWithTranslations(nameTexts, nameTranslations),
                description: createTextFieldWithTranslations(descriptionTexts, descriptionTranslations),
                category: createTextFieldWithTranslations(categoryTexts, categoryTranslations)
            })
                .from(dbSchema.ontology_fields)
                .where(and(
                    inArray(dbSchema.ontology_fields.id, fieldIds),
                    eq(dbSchema.ontology_fields.project_id, projectId)
                ))
                .leftJoin(nameTexts, eq(dbSchema.ontology_fields.name_id, nameTexts.id))
                .leftJoin(nameTranslations, eq(nameTexts.id, nameTranslations.text_id))
                .leftJoin(descriptionTexts, eq(dbSchema.ontology_fields.description_id, descriptionTexts.id))
                .leftJoin(descriptionTranslations, eq(descriptionTexts.id, descriptionTranslations.text_id))
                .leftJoin(categoryTexts, eq(dbSchema.ontology_fields.category_id, categoryTexts.id))
                .leftJoin(categoryTranslations, eq(categoryTexts.id, categoryTranslations.text_id))
                .groupBy(dbSchema.ontology_fields.id);

            const results = await query.execute();
            return processTranslations(results, ['name', 'description', 'category']);
        }
    };
};
