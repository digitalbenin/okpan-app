import * as schema from '../../db/schema';
import { API_SECTIONS } from '$lib/utils/queries.js';

// Create a singleton instance
let storeInstance = null;

// Main store function that creates and returns the store
export function getLogStore() {
    // If we already have an instance, return it
    if (storeInstance) {
        return storeInstance;
    }

    // State variables defined inside the function
    const logState = $state({
        logs: [],
        isLoading: false,
        error: null,
        isInitialized: false,
        pagination: {
            page: 1,
            pageSize: 50,
            totalPages: 1,
            totalLogs: 0
        },
        filters: {
            level: null,
            action: null,
            fromDate: null,
            toDate: null,
            search: null
        }
    });

    // Get queries from API_SECTIONS
    const listLogsQuery = API_SECTIONS.logs.operations.logsList.query;

    const createLogQuery = API_SECTIONS.logs.operations.logsCreate.query;

    const deleteLogQuery = API_SECTIONS.logs.operations.logsDelete.query;

    const clearLogsQuery = API_SECTIONS.logs.operations.logsClear.query;

    // Initialize the store
    const initialize = async () => {
        if (logState.isInitialized) return;

        try {
            logState.isLoading = true;
            logState.error = null;

            // Fetch initial logs
            await fetchLogs();

            logState.isInitialized = true;
        } catch (err) {
            logState.error = `Failed to initialize log store: ${err.message}`;
            console.error('Log store initialization error:', err);
        } finally {
            logState.isLoading = false;
        }
    };

    // Fetch logs with pagination and filters
    const fetchLogs = async (page = 1, pageSize = 50, filters = {}) => {
        try {
            logState.isLoading = true;
            logState.error = null;

            // Update pagination state
            logState.pagination.page = page;
            logState.pagination.pageSize = pageSize;

            // Apply filters
            const appliedFilters = {
                ...logState.filters,
                ...filters
            };
            logState.filters = appliedFilters;

            // Prepare variables for GraphQL query
            const variables = {
                page: (page - 1) * pageSize, // Convert to zero-based offset
                pageSize: pageSize,
                level: appliedFilters.level || undefined,
                action: appliedFilters.action || undefined,
                fromDate: appliedFilters.fromDate ? String(appliedFilters.fromDate) : undefined,
                toDate: appliedFilters.toDate ? String(appliedFilters.toDate) : undefined,
                search: appliedFilters.search ? `%${appliedFilters.search}%` : undefined
            };

            // Execute GraphQL query
            const result = await window.api.executeGraphQL(listLogsQuery, variables);

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch logs"
                );
            }

            // Update state with fetched logs
            logState.logs = result.data.logs.map(log => {
                // Parse JSON details if it exists and the field exists in the schema
                if (log.details && typeof log.details === 'string') {
                    try {
                        log.details = JSON.parse(log.details);
                    } catch (e) {
                        // Keep as string if parsing fails
                    }
                }
                return log;
            });

            // Update pagination info
            const totalLogs = result.data.totalLogs ? result.data.totalLogs.length : 0;
            logState.pagination.totalLogs = totalLogs;
            logState.pagination.totalPages = Math.ceil(totalLogs / pageSize);

            return {
                success: true,
                logs: logState.logs,
                pagination: logState.pagination
            };
        } catch (err) {
            logState.error = `Failed to fetch logs: ${err.message}`;
            console.error('Error fetching logs:', err);
            return {
                success: false,
                error: err.message
            };
        } finally {
            logState.isLoading = false;
        }
    };

    // Create a new log entry
    const createLog = async (logData) => {
        try {
            // Prepare variables for GraphQL mutation
            const variables = {
                level: logData.level || 'error',
                action: logData.action,
                message: logData.message
            };

            // Execute GraphQL mutation
            const result = await window.api.executeGraphQL(createLogQuery, variables);

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to create log"
                );
            }

            // Refresh logs if needed
            if (logState.isInitialized) {
                await fetchLogs(logState.pagination.page, logState.pagination.pageSize);
            }

            return {
                success: true,
                log: result.data.insertIntoLogs[0]
            };
        } catch (err) {
            console.error('Error creating log:', err);
            return {
                success: false,
                error: err.message
            };
        }
    };

    // Delete a log entry
    const deleteLog = async (id) => {
        try {
            logState.isLoading = true;
            logState.error = null;

            // Execute GraphQL mutation
            const result = await window.api.executeGraphQL(deleteLogQuery, { id });

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to delete log"
                );
            }

            // Refresh logs
            await fetchLogs(logState.pagination.page, logState.pagination.pageSize);

            return { success: true };
        } catch (err) {
            logState.error = `Failed to delete log: ${err.message}`;
            console.error('Error deleting log:', err);
            return {
                success: false,
                error: err.message
            };
        } finally {
            logState.isLoading = false;
        }
    };

    // Clear logs based on filters
    const clearLogs = async (filters = {}) => {
        try {
            logState.isLoading = true;
            logState.error = null;

            // Apply filters
            const appliedFilters = {
                ...logState.filters,
                ...filters
            };

            // Prepare variables for GraphQL mutation
            const variables = {
                level: appliedFilters.level || undefined,
                action: appliedFilters.action || undefined,
                fromDate: appliedFilters.fromDate ? String(appliedFilters.fromDate) : undefined,
                toDate: appliedFilters.toDate ? String(appliedFilters.toDate) : undefined
            };

            // Execute GraphQL mutation
            const result = await window.api.executeGraphQL(clearLogsQuery, variables);

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to clear logs"
                );
            }

            // Refresh logs
            await fetchLogs(1, logState.pagination.pageSize, {});

            return { success: true };
        } catch (err) {
            logState.error = `Failed to clear logs: ${err.message}`;
            console.error('Error clearing logs:', err);
            return {
                success: false,
                error: err.message
            };
        } finally {
            logState.isLoading = false;
        }
    };

    // Get available log levels
    const getLogLevels = () => {
        return ['error', 'warn', 'info', 'debug'];
    };

    // Get unique actions from current logs
    const getUniqueActions = () => {
        const actions = new Set();
        logState.logs.forEach(log => {
            if (log.action) actions.add(log.action);
        });
        return Array.from(actions);
    };

    // Convenience methods for different log levels
    const error = async (action, message) => {
        return await createLog({
            level: 'error',
            action,
            message
        });
    };

    const warn = async (action, message) => {
        return await createLog({
            level: 'warn',
            action,
            message
        });
    };

    const info = async (action, message) => {
        return await createLog({
            level: 'info',
            action,
            message
        });
    };

    const debug = async (action, message) => {
        return await createLog({
            level: 'debug',
            action,
            message
        });
    };

    // Start initialization if not already initialized
    if (!logState.isInitialized && !logState.isLoading) {
        // Start initialization asynchronously
        setTimeout(() => {
            initialize();
        }, 0);
    }

    // Create the store instance
    storeInstance = {
        logState,
        initialize,
        fetchLogs,
        createLog,
        deleteLog,
        clearLogs,
        getLogLevels,
        getUniqueActions,
        error,
        warn,
        info,
        debug
    };

    return storeInstance;
}
