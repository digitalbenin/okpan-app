import { buildSchema } from 'drizzle-graphql';
import {
    project, institutions, research_fields, settings, assets,
    objects, datasources, assets_institutions, vocabularies,
    objects_research_fields, ontology_fields, objects_ontology_fields,
    templates, import_table, objects_assets
} from './schema.js';
import { GraphQLObjectType, GraphQLNonNull, GraphQLList, GraphQLInputObjectType, GraphQLString, GraphQLSchema, GraphQLInt } from 'graphql';

function createMutationField(queryField, table, inputFields) {
    const SelectItemType = queryField.type.ofType.ofType;
    const tableName = queryField.name;

    // Create input type for this entity
    const InputType = new GraphQLInputObjectType({
        name: `${tableName.charAt(0).toUpperCase() + tableName.slice(1)}Input`,
        fields: () => inputFields  // Make fields a function to allow circular references
    });

    return {
        type: new GraphQLNonNull(new GraphQLList(SelectItemType)),
        args: {
            values: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(InputType))) }
        },
        resolve: async (_, args, context) => {
            const result = await context.db.insert(table).values(args.values);
            const inserted = await context.db.query[tableName].findMany({
                orderBy: (fields, { desc }) => [desc(fields.id)],
                limit: args.values.length
            });
            return inserted;
        }
    };
}

export function createGraphQLSchema(db) {
    const baseSchema = buildSchema(db);
    const queryType = baseSchema.schema.getQueryType();
    const queryFields = queryType.getFields();

    // Define input fields for each entity
    const institutionsInputFields = {
        name: { type: GraphQLString },
        description: { type: GraphQLString },
        country: { type: GraphQLString },
        location: { type: GraphQLString },
        website: { type: GraphQLString },
        links: { type: GraphQLString },
        logo: { type: GraphQLString },
        project_id: { type: GraphQLInt }  // Foreign key as Int
    };

    // Define mutation fields for each entity
    const mutationFields = {
        insertIntoProject: createMutationField(queryFields.project, project, {
            title: { type: GraphQLString },
            description: { type: GraphQLString }
        }),
        insertIntoInstitutions: createMutationField(queryFields.institutions, institutions, institutionsInputFields),
        insertIntoResearchFields: createMutationField(queryFields.research_fields, research_fields, {
            name: { type: GraphQLString },
            type: { type: GraphQLString },
            description: { type: GraphQLString },
            project_id: { type: GraphQLInt }
        }),
        insertIntoSettings: createMutationField(queryFields.settings, settings, {
            username: { type: GraphQLString },
            password: { type: GraphQLString },
            db_name: { type: GraphQLString },
            sync_url: { type: GraphQLString },
            sig_server: { type: GraphQLString },
            project_id: { type: GraphQLInt }
        }),
        insertIntoAssets: createMutationField(queryFields.assets, assets, {
            filename: { type: GraphQLString },
            path: { type: GraphQLString },
            type: { type: GraphQLString },
            properties: { type: GraphQLString },
            institution_id: { type: GraphQLInt }
        }),
        insertIntoObjects: createMutationField(queryFields.objects, objects, {
            status: { type: GraphQLString },
            institution_id: { type: GraphQLInt }
        }),
        insertIntoDatasources: createMutationField(queryFields.datasources, datasources, {
            name: { type: GraphQLString },
            language: { type: GraphQLString },
            copyright: { type: GraphQLString },
            method: { type: GraphQLString },
            contact: { type: GraphQLString },
            notes: { type: GraphQLString },
            institution_id: { type: GraphQLInt }
        }),
        insertIntoAssetsInstitutions: createMutationField(queryFields.assets_institutions, assets_institutions, {
            rule: { type: GraphQLString },
            asset_id: { type: GraphQLInt },
            institution_id: { type: GraphQLInt }
        }),
        insertIntoVocabularies: createMutationField(queryFields.vocabularies, vocabularies, {
            option: { type: GraphQLString },
            description: { type: GraphQLString },
            main_asset: { type: GraphQLString },
            other_assets: { type: GraphQLString },
            field_id: { type: GraphQLInt }
        }),
        insertIntoObjectsResearchFields: createMutationField(queryFields.objects_research_fields, objects_research_fields, {
            value: { type: GraphQLString },
            object_id: { type: GraphQLInt },
            field_id: { type: GraphQLInt }
        }),
        insertIntoOntologyFields: createMutationField(queryFields.ontology_fields, ontology_fields, {
            name: { type: GraphQLString },
            description: { type: GraphQLString },
            category: { type: GraphQLString },
            embeddings: { type: GraphQLString }
        }),
        insertIntoObjectsOntologyFields: createMutationField(queryFields.objects_ontology_fields, objects_ontology_fields, {
            label: { type: GraphQLString },
            value: { type: GraphQLString },
            object_id: { type: GraphQLInt },
            field_id: { type: GraphQLInt },
            datasources_id: { type: GraphQLInt }
        }),
        insertIntoTemplates: createMutationField(queryFields.templates, templates, {
            name: { type: GraphQLString },
            description: { type: GraphQLString },
            institutions: { type: GraphQLString },
            config: { type: GraphQLString },
            asset_map_rule: { type: GraphQLString },
            datasource_id: { type: GraphQLInt }
        }),
        insertIntoImport: createMutationField(queryFields.import_table, import_table, {
            filename: { type: GraphQLString },
            data: { type: GraphQLString },
            template_id: { type: GraphQLInt }
        }),
        insertIntoObjectsAssets: createMutationField(queryFields.objects_assets, objects_assets, {
            order: { type: GraphQLString },
            asset_id: { type: GraphQLInt },
            object_id: { type: GraphQLInt }
        })
    };

    // Create mutation type with all fields
    const mutationType = new GraphQLObjectType({
        name: 'Mutation',
        fields: mutationFields
    });

    // Create schema with queries and mutations
    const schema = new GraphQLSchema({
        query: baseSchema.schema.getQueryType(),
        mutation: mutationType
    });

    return { schema, resolvers: baseSchema.resolvers };
} 