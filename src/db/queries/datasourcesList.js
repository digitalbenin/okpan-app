import { sql, eq, aliasedTable } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema';
import { addCountField, createTextFieldWithTranslations, processTranslations } from './common';

export const createDatasourcesListQuery = (db, drizzleResult) => {
    // Add count fields to DatasourcesSelectItem type
    addCountField(drizzleResult, 'DatasourcesSelectItem', 'objectsCount');

    return {
        name: 'datasourcesList',
        type: new GraphQLList(new GraphQLNonNull(drizzleResult.schema._typeMap.DatasourcesSelectItem)),
        args: [
            {
                name: 'institution_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter datasources by institution ID'
            },
            {
                name: 'page',
                type: drizzleResult.schema._typeMap.Int,
                description: 'Page number for pagination (0-based)',
                defaultValue: 0
            },
            {
                name: 'pageSize',
                type: drizzleResult.schema._typeMap.Int,
                description: 'Number of items per page',
                defaultValue: 10
            },
            {
                name: 'orderBy',
                type: drizzleResult.schema._typeMap.String,
                description: 'Field to order by (created_at, updated_at, name)',
                defaultValue: 'created_at'
            },
            {
                name: 'direction',
                type: drizzleResult.schema._typeMap.String,
                description: 'Sort direction (asc or desc)',
                defaultValue: 'desc'
            }
        ],
        resolve: async (source, args, context, info) => {
            // Create aliases for the texts tables
            const nameTexts = aliasedTable(dbSchema.texts, 'name_texts');
            const methodTexts = aliasedTable(dbSchema.texts, 'method_texts');
            const notesTexts = aliasedTable(dbSchema.texts, 'notes_texts');

            // Create aliases for the translations tables
            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const methodTranslations = aliasedTable(dbSchema.translations, 'method_translations');
            const notesTranslations = aliasedTable(dbSchema.translations, 'notes_translations');

            // Create subquery to count distinct objects linked via ontology fields
            const objectsOntologyFieldsSubquery = db
                .select({
                    datasources_id: dbSchema.objects_ontology_fields.datasources_id,
                    // Use count(distinct object_id) to count unique objects per datasource
                    objects_count: sql`count(distinct ${dbSchema.objects_ontology_fields.object_id})`.as('objects_count')
                })
                .from(dbSchema.objects_ontology_fields)
                // Ensure we only consider rows where datasource_id is not null
                .where(sql`${dbSchema.objects_ontology_fields.datasources_id} IS NOT NULL`)
                .groupBy(dbSchema.objects_ontology_fields.datasources_id)
                .as('objects_ontology_fields_subquery');

            // Build the base query
            let query = db.select({
                id: dbSchema.datasources.id,
                created_at: dbSchema.datasources.created_at,
                updated_at: dbSchema.datasources.updated_at,
                institution_id: dbSchema.datasources.institution_id,
                language: dbSchema.datasources.language,
                copyright: dbSchema.datasources.copyright,
                contact: dbSchema.datasources.contact,
                date: dbSchema.datasources.date,
                name: createTextFieldWithTranslations(nameTexts, nameTranslations),
                method: createTextFieldWithTranslations(methodTexts, methodTranslations),
                notes: createTextFieldWithTranslations(notesTexts, notesTranslations),
                // Include the object count, defaulting to 0 if no objects are linked
                objectsCount: sql`COALESCE(${objectsOntologyFieldsSubquery.objects_count}, 0)`.as('objectsCount')
            })
                .from(dbSchema.datasources)
                // Left join with the subquery to get the object count
                .leftJoin(objectsOntologyFieldsSubquery, eq(dbSchema.datasources.id, objectsOntologyFieldsSubquery.datasources_id))
                // Joins for translated fields
                .leftJoin(nameTexts, eq(dbSchema.datasources.name_id, nameTexts.id))
                .leftJoin(nameTranslations, eq(nameTexts.id, nameTranslations.text_id))
                .leftJoin(methodTexts, eq(dbSchema.datasources.method_id, methodTexts.id))
                .leftJoin(methodTranslations, eq(methodTexts.id, methodTranslations.text_id))
                .leftJoin(notesTexts, eq(dbSchema.datasources.notes_id, notesTexts.id))
                .leftJoin(notesTranslations, eq(notesTexts.id, notesTranslations.text_id));

            // Apply institution_id filter if provided
            if (args.institution_id) {
                query = query.where(eq(dbSchema.datasources.institution_id, args.institution_id));
            }

            // Apply ordering
            let orderByField;
            const direction = args.direction === 'asc' ? 'asc' : 'desc';

            switch (args.orderBy) {
                case 'created_at':
                    orderByField = dbSchema.datasources.created_at;
                    break;
                case 'updated_at':
                    orderByField = dbSchema.datasources.updated_at;
                    break;
                case 'name':
                    // Order by the original content of the name text
                    orderByField = nameTexts.content;
                    break;
                default:
                    orderByField = dbSchema.datasources.created_at;
            }

            // Add ordering to the query
            query = query.orderBy(direction === 'asc' ? orderByField : sql`${orderByField} DESC`);

            // Apply pagination
            query = query
                .limit(args.pageSize)
                .offset(args.page * args.pageSize)
                // Group by datasource ID to consolidate translations and object count
                .groupBy(dbSchema.datasources.id);

            // Execute the paginated query
            const datasources = await query.execute();

            // Process translations FIRST
            const processedDatasources = processTranslations(datasources, ['name', 'method', 'notes']);

            return processedDatasources; // Return results without server-side date formatting
        }
    };
}; 