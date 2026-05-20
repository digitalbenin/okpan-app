/**
 * IPC handlers for template matching suggestions.
 * @namespace backend.handlers.templateMatchingHandler
 * @memberof backend.handlers
 */
import { findMatchingTemplates } from '../services/templateMatchingService.js';

/**
 * Find import templates that match a given set of column headers.
 * @memberof backend.handlers.templateMatchingHandler
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Array<string>} inputHeaders - Column headers to match against.
 * @param {string} projectId - Target project ID.
 * @param {string|null} [institutionId] - Optional institution scope filter.
 * @returns {Promise<Object>}
 */
export async function handleSuggestTemplateReuse(event, inputHeaders, projectId, institutionId = null) {
    try {
        if (!Array.isArray(inputHeaders) || inputHeaders.length === 0) {
            throw new Error('inputHeaders must be a non-empty array');
        }
        if (!projectId || typeof projectId !== 'string') {
            throw new Error('projectId must be a valid string');
        }

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
