/**
 * Template matching service for finding saved mappings that fully match a set
 * of incoming headers.
 *
 * @namespace backend.services.templateMatchingService
 * @memberof backend.services
 */
import { db } from '../../db/init.js';
import { templates, objects_datasources, datasources, texts } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Find templates that fully match a subset of the input headers.
 * @memberof backend.services.templateMatchingService
 * @param {string[]} inputHeaders - Header names from the user's dataset.
 * @param {string} projectId - Project identifier.
 * @param {string} [institutionId] - Optional institution identifier.
 * @returns {Promise<Array>}
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
                const templateHeaders = Array.from(new Set(
                    mapping
                        .filter(m => m && m.headerField) // Only consider mappings with headerField
                        .map(m => String(m.headerField).toLowerCase().trim())
                ));

                if (templateHeaders.length === 0) {
                    continue;
                }

                // Check if all template headers exist in input headers (100% match with subset)
                const allTemplateHeadersFound = templateHeaders.every(templateHeader =>
                    normalizedInputHeaders.includes(templateHeader)
                );

                if (allTemplateHeadersFound) {
                    const usageInfo = await getTemplateUsageInfo(template.id);
                    const templateDatasources = await getTemplateDatasources(template.id);

                    matchingTemplates.push({
                        id: template.id,
                        mapping: mapping,
                        project_id: template.project_id,
                        institution_id: template.institution_id,
                        asset_map_rule: template.asset_map_rule,
                        created_at: template.created_at,
                        updated_at: template.updated_at,
                        usageInfo: usageInfo,
                        datasources: templateDatasources,
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
            if (a.sameInstitution && !b.sameInstitution) return -1;
            if (!a.sameInstitution && b.sameInstitution) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return matchingTemplates;

    } catch (error) {
        console.error('Error finding matching templates:', error);
        throw new Error(`Failed to find matching templates: ${error.message}`);
    }
}

/**
 * Get datasources associated with a template.
 * @memberof backend.services.templateMatchingService
 * @param {string} templateId - Template identifier.
 * @returns {Promise<Array>}
 */
async function getTemplateDatasources(templateId) {
    try {
        return await db
            .select({
                id: datasources.id,
                date: datasources.date,
                name: {
                    content: texts.content
                }
            })
            .from(objects_datasources)
            .innerJoin(datasources, eq(objects_datasources.datasource_id, datasources.id))
            .leftJoin(texts, eq(datasources.name_id, texts.id))
            .where(eq(objects_datasources.template_id, templateId))
            .groupBy(datasources.id)
            .execute();
    } catch (error) {
        console.error('Error getting template datasources:', error);
        return [];
    }
}

/**
 * Get usage information for a template.
 * @memberof backend.services.templateMatchingService
 * @param {string} templateId - Template identifier.
 * @returns {Promise<Object>}
 */
async function getTemplateUsageInfo(templateId) {
    try {
        const usageRecords = await db
            .select({
                datasource_id: objects_datasources.datasource_id,
                object_id: objects_datasources.object_id
            })
            .from(objects_datasources)
            .where(eq(objects_datasources.template_id, templateId))
            .execute();

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
