import { executeQuery } from "$lib/api/graphqlClient.js";

/**
 * @namespace frontend.api.LogsApi
 */

/**
 * Fetches logs with pagination and filtering.
 * Returns { result: [...logs], count: [...] } since the query has two top-level fields.
 * @param {Object} variables - { page, pageSize, level, action, fromDate, toDate, search }
 * @returns {Promise.<{result: Array, count: Array}>}
 */
export const fetchLogs = async (variables) => {
    return executeQuery('logs', 'list', variables);
};

/**
 * Creates a new log entry.
 * @param {Object} variables - { level, action, message }
 * @returns {Promise.<Array>} Created log record(s)
 */
export const createLog = async (variables) => {
    return executeQuery('logs', 'create', variables);
};

/**
 * Deletes a log entry by ID.
 * @param {Object} variables - { id }
 * @returns {Promise.<Array>} Deleted log record(s)
 */
export const deleteLog = async (variables) => {
    return executeQuery('logs', 'delete', variables);
};

/**
 * Clears logs based on filters.
 * @param {Object} variables - { level, action, fromDate, toDate }
 * @returns {Promise.<Array>} Deleted log records
 */
export const clearLogs = async (variables) => {
    return executeQuery('logs', 'clear', variables);
};
