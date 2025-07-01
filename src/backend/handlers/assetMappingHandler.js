import Fuse from 'fuse.js';
import { db } from '../../db/init.js';
import { objects, objects_ontology_fields, ontology_fields, texts, institutions } from '../../db/schema.js';
import { eq, sql, and, inArray } from 'drizzle-orm';

/**
 * Suggests object matches for a batch of assets using fuzzy matching
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
        // Step 1: Get all objects with their ontology fields
        const objects = await getObjectsWithOntologyFields(institutionId, searchFields);

        if (objects.length === 0) {
            return assets.map(asset => ({
                asset_id: asset.id,
                results: []
            }));
        }

        // Step 2: Prepare search data for Fuse.js
        const searchData = prepareSearchData(objects);

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

        // Step 4: Process each asset
        const results = assets.map(asset => {
            const searchQuery = getSearchQuery(asset.filename, prefix, suffix);
            const suggestions = findMatches(fuse, searchQuery, maxSuggestions, minConfidence);

            return {
                asset_id: asset.id,
                results: suggestions.map(suggestion => ({
                    object_id: suggestion.objectId,
                    score: suggestion.confidence,
                    matched_field: suggestion.matchedField.fieldName
                }))
            };
        });

        return results;

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
            object_id: objects.id,
            object_status: objects.status,
            object_institution_id: objects.institution_id,
            object_project_id: objects.project_id,
            field_id: objects_ontology_fields.field_id,
            field_value: objects_ontology_fields.value,
            field_label: objects_ontology_fields.label,
            field_primary: objects_ontology_fields.primary,
            ontology_field_name: texts.content
        })
        .from(objects)
        .innerJoin(objects_ontology_fields, eq(objects.id, objects_ontology_fields.object_id))
        .leftJoin(ontology_fields, eq(objects_ontology_fields.field_id, ontology_fields.id))
        .leftJoin(texts, eq(ontology_fields.name_id, texts.id))
        .where(sql`${objects_ontology_fields.value} IS NOT NULL AND ${objects_ontology_fields.value} != ''`);

    // Filter by institution if specified
    if (institutionId) {
        query = query.where(eq(objects.institution_id, institutionId));
    }

    // Filter by specific fields if specified, otherwise use primary fields
    if (searchFields.length > 0) {
        const lowerSearchFields = searchFields.map(f => `'${f.toLowerCase()}'`).join(', ');
        query = query.where(sql`LOWER(${texts.content}) IN (${sql.raw(lowerSearchFields)})`);
    } else {
        query = query.where(eq(objects_ontology_fields.primary, 1));
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
