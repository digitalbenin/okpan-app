/**
 * Semantic import-field mapping service for matching CSV headers to ontology
 * fields using embeddings.
 *
 * @namespace backend.services.fieldMappingService
 * @memberof backend.services
 */
import { db } from '../../db/init.js';
import { ontology_fields, texts } from '../../db/schema.js';
import { eq, sql, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { embeddingService } from '../services/embeddingService.js';
import { getCurrentProjectId } from '../services/projectCacheService.js';

/**
 * Suggest ontology mappings for import fields, scoped to the active project.
 * @memberof backend.services.fieldMappingService
 * @method
 * @param {string[]} csvFieldNames - CSV field names to map.
 * @param {Object} [options={}] - Mapping options.
 * @returns {Promise<Array>}
 */
export const suggestFieldMappings = async (csvFieldNames, options = {
    maxSuggestions: 3,
    threshold: 0.2,
    excludeFieldIds: [],
    projectId: null // Optional: will auto-read from cache if not provided
}) => {

    const {
        maxSuggestions = 3,
        threshold = 0.2,
        excludeFieldIds = [],
        projectId = null
    } = options || {};
    // Auto-resolve projectId from cache if not explicitly provided
    const effectiveProjectId = projectId ?? getCurrentProjectId();
    try {

        // Get all ontology fields with embeddings
        const nameTexts = alias(texts, 'name_texts');
        const descTexts = alias(texts, 'desc_texts');

        // Build where conditions to ensure we only consider ontology fields
        // belonging to the active project and with existing embeddings.
        const conditions = [
            isNotNull(ontology_fields.embeddings)
        ];

        // Scope to the active project (from param or cache)
        if (effectiveProjectId) {
            conditions.push(eq(ontology_fields.project_id, effectiveProjectId));
        }

        // Exclude specific field IDs if provided
        if (excludeFieldIds.length > 0) {
            conditions.push(sql`${ontology_fields.id} NOT IN (${excludeFieldIds.map(id => `'${id}'`).join(', ')})`);
        }

        // Combine conditions with AND
        let whereCombined = conditions[0];
        for (let i = 1; i < conditions.length; i++) {
            whereCombined = sql`${whereCombined} AND ${conditions[i]}`;
        }

        const ontologyFields = await db
            .select({
                id: ontology_fields.id,
                embeddings: ontology_fields.embeddings,
                name_content: nameTexts.content,
                description_content: descTexts.content
            })
            .from(ontology_fields)
            .leftJoin(nameTexts, eq(ontology_fields.name_id, nameTexts.id))
            .leftJoin(descTexts, eq(ontology_fields.description_id, descTexts.id))
            .where(whereCombined)
            .execute();

        if (ontologyFields.length === 0) {
            //console.warn('No ontology fields with embeddings found');
            return csvFieldNames.map(fieldName => ({
                csvField: fieldName,
                suggestions: []
            }));
        }

        //console.log(`Found ${ontologyFields.length} ontology fields with embeddings for project`, effectiveProjectId);

        // Process each CSV field
        const results = [];

        for (const csvFieldName of csvFieldNames) {
            try {
                const similarities = await embeddingService.findSimilarFields(
                    csvFieldName,
                    ontologyFields,
                    threshold
                );

                // Take top suggestions and format response
                const suggestions = similarities
                    .slice(0, maxSuggestions)
                    .map(match => ({
                        ontologyFieldId: match.field.id,
                        ontologyFieldName: match.field.name_content,
                        ontologyFieldDescription: match.field.description_content,
                        similarity: Math.round(match.similarity * 100) / 100, // Round to 2 decimals
                        confidence: match.confidence,
                        matchType: match.matchType
                    }));

                results.push({
                    csvField: csvFieldName,
                    suggestions
                });

                //console.log(`Found ${suggestions.length} matches for "${csvFieldName}"`);

            } catch (error) {
                console.error(`Error processing field "${csvFieldName}":`, error);
                results.push({
                    csvField: csvFieldName,
                    suggestions: [],
                    error: error.message
                });
            }
        }

        //console.log(`Completed semantic mapping for ${csvFieldNames.length} fields`);
        console.log('[ImportMatchDebug][Backend] suggestFieldMappings:done', {
            fieldCount: csvFieldNames.length,
            resultCount: results.length,
            nonEmptyCount: results.filter((entry) => (entry?.suggestions || []).length > 0).length,
            projectId: effectiveProjectId
        });
        return results;

    } catch (error) {
        console.error('Error in suggestFieldMappings:', error);
        throw new Error(`Field mapping failed: ${error.message}`);
    }
};