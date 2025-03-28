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

    // Define queries directly in the file
    const logsList = {
        type: "query",
        name: "List Logs",
        description: "Retrieves logs with pagination and filtering",
        query: `query ListLogs($page: Int!, $pageSize: Int!, $level: String, $action: String, $fromDate: String, $toDate: String, $search: String) {
  result: logs(
    limit: $pageSize
    offset: $page
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
      message: { like: $search }
    }
  ) {
    id
    created_at
    level
    action
    message
  }
  
  # Get total count for pagination
  count: logs(
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
      message: { like: $search }
    }
  ) {
    id
  }
}`
    };

    const logsCreate = {
        type: "mutation",
        name: "Create Log",
        description: "Creates a new log entry",
        query: `mutation CreateLog($level: String!, $action: String!, $message: String!) {
  insertIntoLogs(values: [{
    level: $level,
    action: $action,
    message: $message
  }]) {
    id
    created_at
    level
    action
    message
  }
}`
    };

    const logsDelete = {
        type: "mutation",
        name: "Delete Log",
        description: "Deletes a log entry by ID",
        query: `mutation DeleteLog($id: String!) {
  deleteFromLogs(where: { id: { eq: $id } }) {
    id
  }
}`
    };

    const logsClear = {
        type: "mutation",
        name: "Clear Logs",
        description: "Clears logs based on filters",
        query: `mutation ClearLogs($level: String, $action: String, $fromDate: String, $toDate: String) {
  deleteFromLogs(
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
    }
  ) {
    id
  }
}`
    };

    // Initialize the store
    const initialize = async () => {
        if (logState.isInitialized) return;

        await fetchLogs();
        logState.isInitialized = true;
    };

    // Fetch logs with pagination and filters
    const fetchLogs = async (page = 1, pageSize = 50, filters = {}) => {
        try {
            logState.isLoading = true;

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

            // Execute GraphQL query directly
            const response = await window.api.executeGraphQL(logsList.query, variables);

            // Extract data from response
            const result = response.data;

            // Update state with fetched logs
            logState.logs = result.result.map(log => {
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
            const totalLogs = result.count ? result.count.length : 0;
            logState.pagination.totalLogs = totalLogs;
            logState.pagination.totalPages = Math.ceil(totalLogs / pageSize);

            return {
                success: true,
                logs: logState.logs,
                pagination: logState.pagination
            };
        } catch (err) {
            console.error('Error fetching logs:', err);
            logState.error = `Failed to fetch logs: ${err.message}`;
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

            // Execute GraphQL mutation directly
            const response = await window.api.executeGraphQL(logsCreate.query, variables);
            const result = response.data;

            // Refresh logs if needed
            if (logState.isInitialized) {
                await fetchLogs(logState.pagination.page, logState.pagination.pageSize);
            }

            return {
                success: true,
                log: result.insertIntoLogs[0]
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

            // Execute GraphQL mutation directly
            await window.api.executeGraphQL(logsDelete.query, { id });

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

            // Execute GraphQL mutation directly
            await window.api.executeGraphQL(logsClear.query, variables);

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
