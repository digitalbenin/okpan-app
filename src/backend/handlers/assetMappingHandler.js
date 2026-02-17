import Fuse from 'fuse.js';
import { db } from '../../db/init.js';
import * as dbSchema from '../../db/schema.js';
import { eq, sql, and, inArray, aliasedTable } from 'drizzle-orm';
/**
 * Suggests object matches for a batch of assets using fuzzy matching.
 * The response includes the full asset object and the full matched objects, including their ontology and research fields.
 * @param {Array} assets - Array of asset objects with filename property
 * @param {Object} options - Configuration options
 * @param {string} [options.institutionId] - Filter objects by institution ID
 * @param {Array<string>} [options.searchFields] - Custom fields to search in (default: primary id fields)
 * @param {string} [options.prefix] - Prefix to add to asset filename when searching
 * @param {string} [options.suffix] - Suffix to add to asset filename when searching
 * @param {number} [options.maxSuggestions=1] - Maximum number of suggestions per asset
 * @param {number} [options.minConfidence=0.3] - Minimum confidence score (0-1)
 * @param {Object} [options.fuseOptions] - Custom Fuse.js options
 * @returns {Array} Array of objects with asset info and suggested matches
 */
export const suggestObjectMatches = async (assets, options = {}) => {
    const {
        institutionId,
        searchFields = [], // Empty means use primary fields
        prefix = '',
        suffix = '',
        maxSuggestions = 1,
        minConfidence = 0.3,
        fuseOptions = {}
    } = options;

    try {
        // Step 1: Get all objects with their ontology fields for searching
        const objectsForSearch = await getObjectsWithOntologyFields(institutionId, searchFields);

        console.log(`Loaded ${objectsForSearch.length} objects for searching.`);
        if (objectsForSearch.length === 0) {
            return assets.map(asset => ({
                asset: asset,
                results: []
            }));
        }

        // Step 2: Prepare search data for Fuse.js
        const searchData = prepareSearchData(objectsForSearch);

        // Step 3: Configure Fuse.js
        const fuseConfig = {
            keys: ['searchableText', 'fieldName', 'fieldValue'],
            threshold: 1 - minConfidence, // Fuse uses threshold where 0 = exact match, 1 = match anything
            includeScore: true,
            includeMatches: true,
            ignoreLocation: true,
            useExtendedSearch: true,
            ...fuseOptions
        };

        const fuse = new Fuse(searchData, fuseConfig);

        // Step 4: Process each asset to find suggestions
        const resultsWithSuggestions = assets.map(asset => {
            const searchQuery = getSearchQuery(asset.filename, prefix, suffix);
            const suggestions = findMatches(fuse, searchQuery, maxSuggestions, minConfidence);

            return {
                asset: asset,
                suggestions: suggestions
            };
        });

        // Step 5: Get all unique object IDs from suggestions

        console.log('building object payloads from DB for suggested IDs');
        const suggestedObjectIds = Array.from(new Set(
            resultsWithSuggestions.flatMap(r => r.suggestions.map(s => s.objectId))
        ));

        const detailedObjects = await getFullObjectsByIds(suggestedObjectIds);
        const objectsById = new Map(detailedObjects.map(o => [o.id, o]));

        // Step 7: Build final response with full objects
        const finalResults = resultsWithSuggestions.map(r => ({
            asset: r.asset,
            results: r.suggestions.map(suggestion => ({
                object: objectsById.get(suggestion.objectId),
                score: suggestion.confidence,
                matched_field: suggestion.matchedField.fieldName,
                matched_value: suggestion.matchedField.fieldValue
            }))
        }));

        return finalResults;

    } catch (error) {
        console.error('Error in suggestObjectMatches:', error);
        throw new Error(`Asset mapping failed: ${error.message}`);
    }
};

/**
 * Gets objects with their ontology fields, filtered by institution if specified
 */
async function getObjectsWithOntologyFields(institutionId, searchFields) {
    let query = db
        .select({
            object_id: dbSchema.objects.id,
            object_status: dbSchema.objects.status,
            object_institution_id: dbSchema.objects.institution_id,
            object_project_id: dbSchema.objects.project_id,
            field_id: dbSchema.objects_ontology_fields.field_id,
            field_value: dbSchema.objects_ontology_fields.value,
            field_label: dbSchema.objects_ontology_fields.label,
            field_primary: dbSchema.objects_ontology_fields.primary,
            ontology_field_name: dbSchema.texts.content
        })
        .from(dbSchema.objects)
        .innerJoin(dbSchema.objects_ontology_fields, eq(dbSchema.objects.id, dbSchema.objects_ontology_fields.object_id))
        .leftJoin(dbSchema.ontology_fields, eq(dbSchema.objects_ontology_fields.field_id, dbSchema.ontology_fields.id))
        .leftJoin(dbSchema.texts, eq(dbSchema.ontology_fields.name_id, dbSchema.texts.id))
        .where(sql`${dbSchema.objects_ontology_fields.value} IS NOT NULL AND ${dbSchema.objects_ontology_fields.value} != ''`);

    // Filter by institution if specified
    if (institutionId) {
        query = query.where(eq(dbSchema.objects.institution_id, institutionId));
    }

    // Filter by specific field IDs if specified, otherwise use primary fields
    if (searchFields.length > 0) {
        query = query.where(inArray(dbSchema.objects_ontology_fields.field_id, searchFields));
    } else {
        query = query.where(eq(dbSchema.objects_ontology_fields.primary, 1));
    }

    const results = await query.execute();

    // Group by object
    const objectsMap = new Map();

    results.forEach(row => {
        if (!objectsMap.has(row.object_id)) {
            objectsMap.set(row.object_id, {
                id: row.object_id,
                status: row.object_status,
                institution_id: row.object_institution_id,
                project_id: row.object_project_id,
                fields: []
            });
        }

        objectsMap.get(row.object_id).fields.push({
            field_id: row.field_id,
            value: row.field_value,
            label: row.field_label,
            primary: row.field_primary,
            name: row.ontology_field_name
        });
    });

    return Array.from(objectsMap.values());
}

/**
 * Prepares search data for Fuse.js from objects and their fields
 */
function prepareSearchData(objects) {
    const searchData = [];

    objects.forEach(obj => {
        obj.fields.forEach(field => {
            if (field.value && field.value.trim()) {
                // Create searchable text by combining value and field name
                const searchableText = `${field.value} ${field.name || ''}`.trim();

                // Split the value into words for better fuzzy matching
                const words = field.value.split(/\s+/).filter(word => word.length > 0);

                searchData.push({
                    objectId: obj.id,
                    objectStatus: obj.status,
                    objectInstitutionId: obj.institution_id,
                    objectProjectId: obj.project_id,
                    fieldId: field.field_id,
                    fieldName: field.name,
                    fieldValue: field.value,
                    fieldLabel: field.label,
                    fieldPrimary: field.primary,
                    searchableText: searchableText,
                    words: words,
                    // Add individual words as separate searchable entries
                    individualWords: words.join(' ')
                });
            }
        });
    });

    return searchData;
}

/**
 * Creates the search query from asset filename with optional prefix/suffix
 */
function getSearchQuery(filename, prefix, suffix) {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    // Add prefix and suffix
    const searchQuery = `${prefix}${nameWithoutExt}${suffix}`;

    return searchQuery;
}

/**
 * Finds matches using Fuse.js and processes the results
 */
function findMatches(fuse, searchQuery, maxSuggestions, minConfidence) {
    // Split search query into words for better matching
    const queryWords = searchQuery.split(/\s+/).filter(word => word.length > 0);

    // Try different search strategies
    const searches = [
        searchQuery, // Exact phrase
        queryWords.join(' | '), // Any word match (Fuse extended search)
        ...queryWords // Individual words
    ];

    const allMatches = new Map(); // Use Map to avoid duplicates by object ID

    searches.forEach(query => {
        const results = fuse.search(query);

        results.forEach(result => {
            const confidence = 1 - result.score; // Convert Fuse score to confidence

            if (confidence >= minConfidence) {
                const objectId = result.item.objectId;

                // Keep the best match for each object
                if (!allMatches.has(objectId) || allMatches.get(objectId).confidence < confidence) {
                    allMatches.set(objectId, {
                        objectId: objectId,
                        confidence: confidence,
                        score: result.score,
                        matchedField: {
                            fieldId: result.item.fieldId,
                            fieldName: result.item.fieldName,
                            fieldValue: result.item.fieldValue,
                            fieldLabel: result.item.fieldLabel,
                            isPrimary: result.item.fieldPrimary === 1
                        },
                        object: {
                            id: result.item.objectId,
                            status: result.item.objectStatus,
                            institution_id: result.item.objectInstitutionId,
                            project_id: result.item.objectProjectId
                        },
                        matches: result.matches,
                        searchQuery: query
                    });
                }
            }
        });
    });

    // Sort by confidence (descending) and take top matches
    return Array.from(allMatches.values())
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxSuggestions);
}

// Export only the suggestion function
export default {
    suggestObjectMatches
};

/**
 * Fetch full objects (assets, ontology fields, research fields) by IDs
 */
async function getFullObjectsByIds(objectIds) {
    if (objectIds.length === 0) return [];

    try {
        const objects_get_full = aliasedTable(dbSchema.objects, 'objects_get_full');

        // Subquery for assets
        const assets_subquery = sql`(SELECT json_group_array(json_object(
      'order', oa."order",
      'asset', json_object(
        'id', a.id,
        'filename', a.filename,
        'formats', a.formats,
        'path', a.path,
        'type', a.type
      )
    )) FROM objects_assets oa JOIN assets a ON oa.asset_id = a.id WHERE oa.object_id = ${sql.raw(`"objects_get_full"."id"`)} )`;

        // Subquery for ontology fields
        const ontology_fields_subquery = sql`(SELECT json_group_array(json_object(
      'id', oof.id,
      'value', oof.value,
      'primary', oof."primary",
      'default_description', oof.default_description,
      'ontologyField', json_object(
        'id', ot.id,
        'name', json_object(
          'content', ot_name_texts.content
        )
      )
    )) FROM objects_ontology_fields oof JOIN ontology_fields ot ON oof.field_id = ot.id JOIN texts ot_name_texts ON ot.name_id = ot_name_texts.id WHERE oof.object_id = ${sql.raw(`"objects_get_full"."id"`)} )`;

        // Subquery for research fields
        const research_fields_subquery = sql`(SELECT json_group_array(json_object(
      'id', orf.id,
      'value', orf.value,
      'vocabulary_id', orf.vocabulary_id,
      'researchField', json_object(
        'id', rf.id,
        'name', json_object(
          'content', rf_name_texts.content
        )
      ),
      'vocabulary', json_object(
        'id', v.id,
        'option', json_object(
          'content', v_option_texts.content
                ),
                'mainAsset', json_object(
                    'id', ga.id,
                    'path', ga.path,
                    'formats', ga.formats,
                    'type', ga.type
                )
      )
        )) FROM objects_research_fields orf JOIN research_fields rf ON orf.field_id = rf.id JOIN texts rf_name_texts ON rf.name_id = rf_name_texts.id LEFT JOIN vocabularies v ON orf.vocabulary_id = v.id LEFT JOIN texts v_option_texts ON v.option_id = v_option_texts.id LEFT JOIN generic_assets ga ON v.main_asset_id = ga.id WHERE orf.object_id = ${sql.raw(`"objects_get_full"."id"`)} )`;

        const query = db
            .select({
                id: objects_get_full.id,
                name: objects_get_full.name,
                created_at: objects_get_full.created_at,
                updated_at: objects_get_full.updated_at,
                status: objects_get_full.status,
                institution_id: objects_get_full.institution_id,
                project_id: objects_get_full.project_id,
                objectsAssets: assets_subquery.as('objects_assets_json'),
                objectsOntologyFields: ontology_fields_subquery.as('objects_ontology_fields_json'),
                objectsResearchFields: research_fields_subquery.as('objects_research_fields_json')
            })
            .from(objects_get_full)
            .where(inArray(objects_get_full.id, objectIds));

        const results = await query.execute();

        // Normalize the JSON fields
        return results.map(obj => ({
            ...obj,
            objectsAssets: obj.objectsAssets ? JSON.parse(obj.objectsAssets) : [],
            objectsOntologyFields: obj.objectsOntologyFields ? JSON.parse(obj.objectsOntologyFields) : [],
            objectsResearchFields: obj.objectsResearchFields ? JSON.parse(obj.objectsResearchFields) : []
        }));
    } catch (error) {
        console.error('Error fetching full objects:', error);
        return [];
    }
}
