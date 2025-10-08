import Fuse from 'fuse.js';
import { db } from '../../db/init.js';
import * as dbSchema from '../../db/schema.js';
import { eq, sql, and, inArray, aliasedTable } from 'drizzle-orm';

/**
 * Fetches complete object details, including ontology and research fields.
 * @param {Array<string>} objectIds - Array of object IDs to fetch.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of full object details.
 */
async function getObjectsDetails(objectIds) {
    if (!objectIds || objectIds.length === 0) {
        return [];
    }

    const ontologyFieldsQuery = sql`(SELECT json_group_array(json_object('id', oof.id, 'value', oof.value, 'field_id', oof.field_id, 'primary', oof."primary", 'default_description', oof.default_description, 'ontology_field_name_id', ot.name_id, 'ontology_field_name_content', ot_name_texts.content )) FROM ${dbSchema.objects_ontology_fields} oof LEFT JOIN ${dbSchema.ontology_fields} ot ON oof.field_id = ot.id LEFT JOIN ${dbSchema.texts} ot_name_texts ON ot.name_id = ot_name_texts.id WHERE oof.object_id = ${dbSchema.objects.id})`;

    const researchFieldsQuery = sql`(SELECT json_group_array(json_object('id', orf.id, 'value', orf.value, 'field_id', orf.field_id, 'research_field_name_id', rf.name_id, 'research_field_name_content', rf_name_texts.content, 'vocabulary_id', orf.vocabulary_id, 'vocabulary_option_content', v_option_texts.content )) FROM ${dbSchema.objects_research_fields} orf LEFT JOIN ${dbSchema.research_fields} rf ON orf.field_id = rf.id LEFT JOIN ${dbSchema.texts} rf_name_texts ON rf.name_id = rf_name_texts.id LEFT JOIN ${dbSchema.vocabularies} v ON orf.vocabulary_id = v.id LEFT JOIN ${dbSchema.texts} v_option_texts ON v.option_id = v_option_texts.id WHERE orf.object_id = ${dbSchema.objects.id})`;

    let query = db.select({
        id: dbSchema.objects.id,
        created_at: dbSchema.objects.created_at,
        updated_at: dbSchema.objects.updated_at,
        status: dbSchema.objects.status,
        institution_id: dbSchema.objects.institution_id,
        project_id: dbSchema.objects.project_id,

        objects_assets_json: sql`(SELECT json_group_array(json_object('order', oa."order", 'asset_id', oa.asset_id, 'asset_filename', a.filename, 'asset_formats', a.formats, 'asset_path', a.path, 'asset_type', a.type, 'asset_real_id', a.id)) FROM ${dbSchema.objects_assets} oa JOIN ${dbSchema.assets} a ON oa.asset_id = a.id WHERE oa.object_id = ${dbSchema.objects.id})`.as('objects_assets_json'),
        objects_ontology_fields_json: ontologyFieldsQuery.as('objects_ontology_fields_json'),
        objects_research_fields_json: researchFieldsQuery.as('objects_research_fields_json'),

    })
        .from(dbSchema.objects)
        .where(inArray(dbSchema.objects.id, objectIds))
        .groupBy(dbSchema.objects.id);

    const rawResults = await query.execute();

    const processedItems = rawResults.map(item => {
        const institution = item.inst_id ? {
            id: item.inst_id,
            name: {
                id: item.inst_name_text_id,
                content: item.inst_name_text_content,
                original_language_id: item.inst_name_text_original_language_id,
                translations: JSON.parse(item.inst_name_translations_json || '[]').filter(t => t.id !== null)
            }
        } : null;

        const project = item.proj_id ? {
            id: item.proj_id,
            title: {
                id: item.proj_title_text_id,
                content: item.proj_title_text_content,
                original_language_id: item.proj_title_text_original_language_id,
                translations: JSON.parse(item.proj_title_translations_json || '[]').filter(t => t.id !== null)
            }
        } : null;

        let objectsAssets = [];
        if (item.objects_assets_json) {
            try {
                const parsedAssets = JSON.parse(item.objects_assets_json);
                objectsAssets = parsedAssets.map(oa => ({
                    order: oa.order,
                    asset: {
                        id: oa.asset_real_id,
                        filename: oa.asset_filename,
                        formats: typeof oa.asset_formats === 'string' ? JSON.parse(oa.asset_formats || '{}') : (oa.asset_formats || {}),
                        path: oa.asset_path,
                        type: oa.asset_type
                    }
                })).filter(oa => oa.asset.id != null);
            } catch (e) { console.error('Error parsing objects_assets_json:', e); }
        }

        let objectsOntologyFields = [];
        if (item.objects_ontology_fields_json) {
            try {
                const parsedFields = JSON.parse(item.objects_ontology_fields_json);
                objectsOntologyFields = parsedFields.map(oof => ({
                    id: oof.id,
                    value: oof.value,
                    primary: oof.primary,
                    default_description: oof.default_description,
                    ontologyField: {
                        id: oof.field_id,
                        name: { content: oof.ontology_field_name_content }
                    }
                })).filter(oof => oof.id != null);
            } catch (e) { console.error('Error parsing objects_ontology_fields_json:', e); }
        }

        let objectsResearchFields = [];
        if (item.objects_research_fields_json) {
            try {
                const parsedFields = JSON.parse(item.objects_research_fields_json);
                objectsResearchFields = parsedFields.map(orf => {
                    const result = {
                        id: orf.id,
                        value: orf.value,
                        vocabulary_id: orf.vocabulary_id,
                        researchField: {
                            id: orf.field_id,
                            name: { content: orf.research_field_name_content }
                        }
                    };
                    if (orf.vocabulary_id && orf.vocabulary_option_content) {
                        result.vocabulary = {
                            id: orf.vocabulary_id,
                            option: { content: orf.vocabulary_option_content }
                        };
                    }
                    return result;
                }).filter(orf => orf.id != null);
            } catch (e) { console.error('Error parsing objects_research_fields_json:', e); }
        }

        return {
            id: item.id,
            created_at: item.created_at,
            updated_at: item.updated_at,
            status: item.status,
            objectsAssets: objectsAssets,
            objectsOntologyFields: objectsOntologyFields,
            objectsResearchFields: objectsResearchFields,
        };
    });
    return processedItems;
}


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
        const allObjectIds = [...new Set(
            resultsWithSuggestions.flatMap(r => r.suggestions.map(s => s.objectId))
        )];

        console.log('before step 6 fetch full objects', allObjectIds);

        // Step 6: Fetch full object data for all suggestions
        const fullObjects = await getObjectsDetails(allObjectIds);
        const fullObjectsById = Object.fromEntries(fullObjects.map(o => [o.id, o]));
        console.log('after step 6 fetch full objects');

        // Step 7: Build final response with full objects
        const finalResults = resultsWithSuggestions.map(r => ({
            asset: r.asset,
            results: r.suggestions.map(suggestion => ({
                object: fullObjectsById[suggestion.objectId],
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

    // Filter by specific fields if specified, otherwise use primary fields
    if (searchFields.length > 0) {
        const lowerSearchFields = searchFields.map(f => `'${f.toLowerCase()}'`).join(', ');
        query = query.where(sql`LOWER(${dbSchema.texts.content}) IN (${sql.raw(lowerSearchFields)})`);
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
