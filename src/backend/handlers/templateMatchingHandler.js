import { db } from '../../db/init.js';
import { templates, objects_datasources, datasources, institutions, texts, translations, languages } from '../../db/schema.js';
import { eq, aliasedTable, and } from 'drizzle-orm';
import { createTextFieldWithTranslations, processTranslations } from '../../db/queries/common.js';

/**
 * Finds templates that have a 100% match with a subset of the input headers
 * @param {string[]} inputHeaders - Array of header names from the user's dataset
 * @param {string} projectId - Project ID to limit search scope
 * @param {string} [institutionId] - Optional institution ID to prioritize templates from same institution
 * @returns {Promise<Array>} Array of matching templates with their details and usage info
 */
export async function findMatchingTemplates(inputHeaders, projectId, institutionId = null) {
    try {
        // Get all templates for the project
        const projectTemplates = await db
            .select({
                id: templates.id,
                mapping: templates.mapping,
                project_id: templates.project_id,
                institution_id: templates.institution_id,
                asset_map_rule: templates.asset_map_rule,
                created_at: templates.created_at,
                updated_at: templates.updated_at
            })
            .from(templates)
            .where(eq(templates.project_id, projectId))
            .execute();

        const matchingTemplates = [];

        // Convert input headers to lowercase for case-insensitive comparison
        const normalizedInputHeaders = inputHeaders.map(header => header.toLowerCase().trim());

        for (const template of projectTemplates) {
            try {
                // Parse the mapping JSON
                const mapping = JSON.parse(template.mapping);

                if (!Array.isArray(mapping) || mapping.length === 0) {
                    continue;
                }

                // Extract template headers and normalize them
                const templateHeaders = mapping
                    .filter(m => m.headerField) // Only consider mappings with headerField
                    .map(m => m.headerField.toLowerCase().trim());

                if (templateHeaders.length === 0) {
                    continue;
                }

                // Check if all template headers exist in input headers (100% match with subset)
                const allTemplateHeadersFound = templateHeaders.every(templateHeader =>
                    normalizedInputHeaders.includes(templateHeader)
                );

                if (allTemplateHeadersFound) {
                    // Get usage info for this template (how many objects/datasources used it)
                    const usageInfo = await getTemplateUsageInfo(template.id);

                    matchingTemplates.push({
                        id: template.id,
                        mapping: mapping, // Use the parsed mapping instead of the raw string
                        project_id: template.project_id,
                        institution_id: template.institution_id,
                        asset_map_rule: template.asset_map_rule,
                        created_at: template.created_at,
                        updated_at: template.updated_at,
                        usageInfo: usageInfo,
                        // Flag templates from the same institution for prioritization
                        sameInstitution: institutionId && template.institution_id === institutionId
                    });
                }
            } catch (parseError) {
                console.warn(`Failed to parse mapping for template ${template.id}:`, parseError);
                continue;
            }
        }

        // Sort: same institution first, then by creation date (newest first)
        matchingTemplates.sort((a, b) => {
            // Prioritize templates from the same institution
            if (a.sameInstitution && !b.sameInstitution) return -1;
            if (!a.sameInstitution && b.sameInstitution) return 1;
            // Then sort by creation date (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return matchingTemplates;

    } catch (error) {
        console.error('Error finding matching templates:', error);
        throw new Error(`Failed to find matching templates: ${error.message}`);
    }
}

/**
 * Gets usage information for a template (how many objects/datasources used it)
 * @param {string} templateId - Template ID to get usage info for
 * @returns {Promise<Object>} Object with usage counts
 */
async function getTemplateUsageInfo(templateId) {
    try {
        // Count how many objects_datasources records use this template
        const usageRecords = await db
            .select({
                datasource_id: objects_datasources.datasource_id,
                object_id: objects_datasources.object_id
            })
            .from(objects_datasources)
            .where(eq(objects_datasources.template_id, templateId))
            .execute();

        // Get unique datasource IDs and object IDs
        const uniqueDatasources = new Set(usageRecords.map(r => r.datasource_id));
        const uniqueObjects = new Set(usageRecords.map(r => r.object_id));

        return {
            datasourcesCount: uniqueDatasources.size,
            objectsCount: uniqueObjects.size
        };

    } catch (error) {
        console.error('Error getting template usage info:', error);
        return { datasourcesCount: 0, objectsCount: 0 };
    }
}

/**
 * Handler for the suggest-template-reuse IPC call
 * @param {Object} event - IPC event object
 * @param {string[]} inputHeaders - Array of header names from the user's dataset
 * @param {string} projectId - Project ID to limit search scope
 * @param {string} [institutionId] - Optional institution ID to prioritize templates from same institution
 * @returns {Promise<Array>} Array of matching templates
 */
export async function handleSuggestTemplateReuse(event, inputHeaders, projectId, institutionId = null) {
    try {
        // Validate input
        if (!Array.isArray(inputHeaders) || inputHeaders.length === 0) {
            throw new Error('inputHeaders must be a non-empty array');
        }

        if (!projectId || typeof projectId !== 'string') {
            throw new Error('projectId must be a valid string');
        }

        // Find matching templates
        const matchingTemplates = await findMatchingTemplates(inputHeaders, projectId, institutionId);

        return {
            success: true,
            matchingTemplates,
            inputHeaders,
            projectId,
            institutionId,
            totalMatches: matchingTemplates.length
        };

    } catch (error) {
        console.error('Error in handleSuggestTemplateReuse:', error);
        return {
            success: false,
            error: error.message,
            matchingTemplates: [],
            inputHeaders,
            projectId,
            institutionId,
            totalMatches: 0
        };
    }
}