import { sql, eq, aliasedTable } from 'drizzle-orm';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import * as dbSchema from '../schema.js';
import { addCountField, createTextFieldWithTranslations, processTranslations } from './common.js';

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
                name: 'object_id',
                type: drizzleResult.schema._typeMap.String,
                description: 'Filter datasources by object ID (via objects_ontology_fields)'
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
        resolve: async (source, args) => {
            const nameTexts = aliasedTable(dbSchema.texts, 'name_texts');
            const methodTexts = aliasedTable(dbSchema.texts, 'method_texts');
            const notesTexts = aliasedTable(dbSchema.texts, 'notes_texts');

            const nameTranslations = aliasedTable(dbSchema.translations, 'name_translations');
            const methodTranslations = aliasedTable(dbSchema.translations, 'method_translations');
            const notesTranslations = aliasedTable(dbSchema.translations, 'notes_translations');

            const nameLanguages = aliasedTable(dbSchema.languages, 'name_languages');
            const methodLanguages = aliasedTable(dbSchema.languages, 'method_languages');
            const notesLanguages = aliasedTable(dbSchema.languages, 'notes_languages');

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

            let query = db.select({
                id: dbSchema.datasources.id,
                created_at: dbSchema.datasources.created_at,
                updated_at: dbSchema.datasources.updated_at,
                institution_id: dbSchema.datasources.institution_id,
                import_id: dbSchema.datasources.import_id,
                source: dbSchema.datasources.source,
                language: dbSchema.datasources.language,
                copyright: dbSchema.datasources.copyright,
                contact: dbSchema.datasources.contact,
                date: dbSchema.datasources.date,
                name: createTextFieldWithTranslations(nameTexts, nameTranslations, nameLanguages),
                method: createTextFieldWithTranslations(methodTexts, methodTranslations, methodLanguages),
                notes: createTextFieldWithTranslations(notesTexts, notesTranslations, notesLanguages),
                objectsCount: sql`COALESCE(${objectsOntologyFieldsSubquery.objects_count}, 0)`.as('objectsCount')
            })
                .from(dbSchema.datasources)
                .leftJoin(objectsOntologyFieldsSubquery, eq(dbSchema.datasources.id, objectsOntologyFieldsSubquery.datasources_id))
                .leftJoin(nameTexts, eq(dbSchema.datasources.name_id, nameTexts.id))
                .leftJoin(nameTranslations, eq(nameTexts.id, nameTranslations.text_id))
                .leftJoin(nameLanguages, eq(nameTranslations.language_id, nameLanguages.id))
                .leftJoin(methodTexts, eq(dbSchema.datasources.method_id, methodTexts.id))
                .leftJoin(methodTranslations, eq(methodTexts.id, methodTranslations.text_id))
                .leftJoin(methodLanguages, eq(methodTranslations.language_id, methodLanguages.id))
                .leftJoin(notesTexts, eq(dbSchema.datasources.notes_id, notesTexts.id))
                .leftJoin(notesTranslations, eq(notesTexts.id, notesTranslations.text_id))
                .leftJoin(notesLanguages, eq(notesTranslations.language_id, notesLanguages.id));

            // Build WHERE conditions array
            const conditions = [];
            
            // Apply institution_id filter if provided
            if (args.institution_id) {
                conditions.push(eq(dbSchema.datasources.institution_id, args.institution_id));
            }

            // Apply object_id filter if provided
            if (args.object_id) {
                // Filter datasources that are linked to the specified object via the junction table
                conditions.push(sql`EXISTS (
                    SELECT 1 FROM ${dbSchema.objects_datasources} 
                    WHERE ${dbSchema.objects_datasources.datasource_id} = ${dbSchema.datasources.id}
                    AND ${dbSchema.objects_datasources.object_id} = ${args.object_id}
                )`);
            }

            // Apply all conditions with AND
            if (conditions.length > 0) {
                query = query.where(sql.join(conditions, sql` AND `));
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

            // Apply pagination and group by to aggregate translations correctly
            query = query
                .limit(args.pageSize)
                .offset(args.page * args.pageSize)
                .groupBy(
                    dbSchema.datasources.id,
                    dbSchema.datasources.created_at,
                    dbSchema.datasources.updated_at,
                    dbSchema.datasources.institution_id,
                    dbSchema.datasources.import_id,
                    dbSchema.datasources.source,
                    dbSchema.datasources.language,
                    dbSchema.datasources.copyright,
                    dbSchema.datasources.contact,
                    dbSchema.datasources.date,
                    nameTexts.id,
                    methodTexts.id,
                    notesTexts.id
                );

            // Execute the paginated query
            const datasources = await query.execute();

            // Process translations arrays for name/method/notes
            const results = processTranslations(datasources, ['name', 'method', 'notes']);
            return results;
        }
    };
}; 