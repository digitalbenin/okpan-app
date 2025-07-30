import { GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql';
import { eq } from 'drizzle-orm';
import * as dbSchema from '../schema';

export const createObjectDisplayFieldsTransformedQuery = (db, drizzleResult) => {
    // Define the transformed type
    const TranslationType = new GraphQLObjectType({
        name: 'Translation',
        fields: {
            id: { type: GraphQLString },
            language_id: { type: GraphQLString },
            content: { type: GraphQLString }
        }
    });

    const TextWithTranslationsType = new GraphQLObjectType({
        name: 'TextWithTranslations',
        fields: {
            id: { type: GraphQLString },
            content: { type: GraphQLString },
            original_language_id: { type: GraphQLString },
            translations: { type: new GraphQLList(TranslationType) }
        }
    });

    const ObjectDisplayFieldTransformed = new GraphQLObjectType({
        name: 'ObjectDisplayFieldTransformed',
        fields: () => ({
            id: { type: GraphQLString },
            type: { type: GraphQLString },
            value: { type: GraphQLString },
            name: { type: TextWithTranslationsType }
        })
    });
    drizzleResult.schema._typeMap.ObjectDisplayFieldTransformed = ObjectDisplayFieldTransformed;

    return {
        name: 'objectDisplayFieldsTransformed',
        type: new GraphQLList(new GraphQLNonNull(ObjectDisplayFieldTransformed)),
        args: [
            {
                name: 'project_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter object display fields by project ID'
            }
        ],
        resolve: async (source, args, context, info) => {
            let query = db
                .select({
                    id: dbSchema.object_display_fields.id,
                    project_id: dbSchema.object_display_fields.project_id,
                    ontology_field_id: dbSchema.object_display_fields.ontology_field_id,
                    research_field_id: dbSchema.object_display_fields.research_field_id,
                    property_name: dbSchema.object_display_fields.property_name
                })
                .from(dbSchema.object_display_fields);

            if (args.project_id) {
                query = query.where(eq(dbSchema.object_display_fields.project_id, args.project_id));
            }

            const rawResults = await query.execute();
            const results = [];

            for (const item of rawResults) {
                let type, value, name = null;
                if (item.property_name) {
                    type = 'object_property';
                    value = item.property_name;
                } else if (item.research_field_id) {
                    type = 'research_field';
                    value = item.research_field_id;
                    const rf = await db.select().from(dbSchema.research_fields).where(eq(dbSchema.research_fields.id, item.research_field_id)).get();
                    if (rf) {
                        const nameText = await db.select().from(dbSchema.texts).where(eq(dbSchema.texts.id, rf.name_id)).get();
                        if (nameText) {
                            const translations = await db.select({ id: dbSchema.translations.id, language_id: dbSchema.translations.language_id, content: dbSchema.translations.content })
                                .from(dbSchema.translations)
                                .where(eq(dbSchema.translations.text_id, nameText.id)).all();
                            name = {
                                id: nameText.id,
                                content: nameText.content,
                                original_language_id: nameText.original_language_id,
                                translations
                            };
                        }
                    }
                } else if (item.ontology_field_id) {
                    type = 'ontology_field';
                    value = item.ontology_field_id;
                    const of = await db.select().from(dbSchema.ontology_fields).where(eq(dbSchema.ontology_fields.id, item.ontology_field_id)).get();
                    if (of) {
                        const nameText = await db.select().from(dbSchema.texts).where(eq(dbSchema.texts.id, of.name_id)).get();
                        if (nameText) {
                            const translations = await db.select({ id: dbSchema.translations.id, language_id: dbSchema.translations.language_id, content: dbSchema.translations.content })
                                .from(dbSchema.translations)
                                .where(eq(dbSchema.translations.text_id, nameText.id)).all();
                            name = {
                                id: nameText.id,
                                content: nameText.content,
                                original_language_id: nameText.original_language_id,
                                translations
                            };
                        }
                    }
                }
                results.push({
                    id: item.id,
                    type,
                    value,
                    name
                });
            }
            return results;
        }
    };
}; 