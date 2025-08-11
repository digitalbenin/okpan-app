import { db } from '../../db/init.js';
import { templates, datasources, institutions, texts, translations, languages } from '../../db/schema.js';
import { eq, aliasedTable } from 'drizzle-orm';
import { createTextFieldWithTranslations, processTranslations } from '../../db/queries/common.js';

/**
 * Finds templates that have a 100% match with a subset of the input headers
 * @param {string[]} inputHeaders - Array of header names from the user's dataset
 * @param {string} projectId - Project ID to limit search scope
 * @returns {Promise<Array>} Array of matching templates with their details, datasources, and institutions
 */
export async function findMatchingTemplates(inputHeaders, projectId) {
    try {
        // Get all templates for the project
        const projectTemplates = await db
            .select({
                id: templates.id,
                mapping: templates.mapping,
                project_id: templates.project_id,
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
                    // Get datasources for this template with their institutions
                    const templateDatasources = await getDatasourcesWithInstitutions(template.id);

                    matchingTemplates.push({
                        id: template.id,
                        mapping: mapping, // Use the parsed mapping instead of the raw string
                        project_id: template.project_id,
                        asset_map_rule: template.asset_map_rule,
                        created_at: template.created_at,
                        updated_at: template.updated_at,
                        datasources: templateDatasources
                    });
                }
            } catch (parseError) {
                console.warn(`Failed to parse mapping for template ${template.id}:`, parseError);
                continue;
            }
        }

        // Sort by creation date (newest first)
        matchingTemplates.sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return matchingTemplates;

    } catch (error) {
        console.error('Error finding matching templates:', error);
        throw new Error(`Failed to find matching templates: ${error.message}`);
    }
}

/**
 * Gets datasources for a template with their associated institutions (only id and name with translations)
 * @param {string} templateId - Template ID to get datasources for
 * @returns {Promise<Array>} Array of datasources with their institutions (minimal info)
 */
async function getDatasourcesWithInstitutions(templateId) {
    try {
        // Create aliases for datasource text fields
        const datasourceNameTexts = aliasedTable(texts, 'datasource_name_texts');
        const datasourceNameTranslations = aliasedTable(translations, 'datasource_name_translations');
        const datasourceNameLanguages = aliasedTable(languages, 'datasource_name_languages');

        // Create aliases for institution text fields
        const institutionNameTexts = aliasedTable(texts, 'institution_name_texts');
        const institutionNameTranslations = aliasedTable(translations, 'institution_name_translations');
        const institutionNameLanguages = aliasedTable(languages, 'institution_name_languages');

        const results = await db
            .select({
                // Datasource fields (only id and name)
                datasource_id: datasources.id,
                datasource_name: createTextFieldWithTranslations(datasourceNameTexts, datasourceNameTranslations, datasourceNameLanguages),

                // Institution fields (only id and name)
                institution_id: institutions.id,
                institution_name: createTextFieldWithTranslations(institutionNameTexts, institutionNameTranslations, institutionNameLanguages)
            })
            .from(datasources)
            .leftJoin(institutions, eq(datasources.institution_id, institutions.id))

            // Join datasource name text and translations
            .leftJoin(datasourceNameTexts, eq(datasources.name_id, datasourceNameTexts.id))
            .leftJoin(datasourceNameTranslations, eq(datasourceNameTexts.id, datasourceNameTranslations.text_id))
            .leftJoin(datasourceNameLanguages, eq(datasourceNameTranslations.language_id, datasourceNameLanguages.id))

            // Join institution name text and translations
            .leftJoin(institutionNameTexts, eq(institutions.name_id, institutionNameTexts.id))
            .leftJoin(institutionNameTranslations, eq(institutionNameTexts.id, institutionNameTranslations.text_id))
            .leftJoin(institutionNameLanguages, eq(institutionNameTranslations.language_id, institutionNameLanguages.id))

            .where(eq(datasources.template_id, templateId))
            .execute();

        // Group results by datasource to handle multiple translations
        const datasourceMap = new Map();

        for (const row of results) {
            if (!datasourceMap.has(row.datasource_id)) {
                datasourceMap.set(row.datasource_id, {
                    id: row.datasource_id,
                    name: row.datasource_name,
                    institution: row.institution_id ? {
                        id: row.institution_id,
                        name: row.institution_name
                    } : null
                });
            }
        }

        const datasourcesList = Array.from(datasourceMap.values());

        // Process translations for text fields
        const processedDatasources = processTranslations(datasourcesList, ['name']);

        // Process translations for institution text fields
        for (const datasource of processedDatasources) {
            if (datasource.institution) {
                const processedInstitution = processTranslations([datasource.institution], ['name']);
                datasource.institution = processedInstitution[0];
            }
        }

        return processedDatasources;

    } catch (error) {
        console.error('Error getting datasources with institutions:', error);
        throw new Error(`Failed to get datasources with institutions: ${error.message}`);
    }
}

/**
 * Handler for the suggest-template-reuse IPC call
 * @param {Object} event - IPC event object
 * @param {string[]} inputHeaders - Array of header names from the user's dataset
 * @param {string} projectId - Project ID to limit search scope
 * @returns {Promise<Array>} Array of matching templates
 */
export async function handleSuggestTemplateReuse(event, inputHeaders, projectId) {
    try {
        // Validate input
        if (!Array.isArray(inputHeaders) || inputHeaders.length === 0) {
            throw new Error('inputHeaders must be a non-empty array');
        }

        if (!projectId || typeof projectId !== 'string') {
            throw new Error('projectId must be a valid string');
        }

        // Find matching templates
        const matchingTemplates = await findMatchingTemplates(inputHeaders, projectId);

        return {
            success: true,
            matchingTemplates,
            inputHeaders,
            projectId,
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
            totalMatches: 0
        };
    }
}