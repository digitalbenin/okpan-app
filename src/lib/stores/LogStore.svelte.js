// Create a singleton instance
let storeInstance = null;

// Helper to safely check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

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

        // Only fetch logs if we're in a browser environment
        if (isBrowser) {
            await fetchLogs();
        }
        logState.isInitialized = true;
    };

    // Fetch logs with pagination and filters
    const fetchLogs = async (page = 1, pageSize = 50, filters = {}) => {
        // Skip if not in browser environment
        if (!isBrowser) {
            return {
                success: false,
                error: "Not in browser environment"
            };
        }

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

        try {
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

            logState.isLoading = false;

            return {
                success: true,
                logs: logState.logs,
                pagination: logState.pagination
            };
        } catch (error) {
            logState.error = error.message;
            logState.isLoading = false;
            return {
                success: false,
                error: error.message
            };
        }
    };

    // Create a new log entry
    const createLog = async (logData) => {
        // Skip if not in browser environment
        if (!isBrowser) {
            return null;
        }

        // Prepare variables for GraphQL mutation
        const variables = {
            level: logData.level || 'error',
            action: logData.action,
            message: logData.message
        };

        try {
            // Execute GraphQL mutation
            const response = await window.api.executeGraphQL(logsCreate.query, variables);

            // Update logs after creating new entry if in browser
            if (isBrowser) {
                await fetchLogs(logState.pagination.page, logState.pagination.pageSize);
            }

            return response.data.insertIntoLogs[0];
        } catch (error) {
            logState.error = error.message;
            return null;
        }
    };

    // Delete a log by ID
    const deleteLog = async (id) => {
        // Skip if not in browser environment
        if (!isBrowser) {
            return null;
        }

        // Prepare variables for GraphQL mutation
        const variables = {
            id: id
        };

        try {
            // Execute GraphQL mutation
            const response = await window.api.executeGraphQL(logsDelete.query, variables);

            // Update logs after deleting entry
            await fetchLogs(logState.pagination.page, logState.pagination.pageSize);

            return response.data;
        } catch (error) {
            logState.error = error.message;
            return null;
        }
    };

    // Clear logs based on filters
    const clearLogs = async (filters = {}) => {
        // Skip if not in browser environment
        if (!isBrowser) {
            return {
                success: false,
                error: "Not in browser environment"
            };
        }

        // Prepare variables for GraphQL mutation
        const variables = {
            level: filters.level || logState.filters.level || undefined,
            action: filters.action || logState.filters.action || undefined,
            fromDate: filters.fromDate || logState.filters.fromDate
                ? String(filters.fromDate || logState.filters.fromDate)
                : undefined,
            toDate: filters.toDate || logState.filters.toDate
                ? String(filters.toDate || logState.filters.toDate)
                : undefined
        };

        try {
            // Execute GraphQL mutation
            const response = await window.api.executeGraphQL(logsClear.query, variables);

            // Update logs after clearing
            await fetchLogs(1, logState.pagination.pageSize);

            return {
                success: true,
                deleted: response.data.deleteFromLogs.length
            };
        } catch (error) {
            logState.error = error.message;
            return {
                success: false,
                error: error.message
            };
        }
    };

    // Get available log levels
    const getLogLevels = () => {
        return ['error', 'warn', 'info', 'debug'];
    };

    // Get unique action values from logs
    const getUniqueActions = () => {
        const actions = new Set();
        logState.logs.forEach(log => {
            if (log.action) actions.add(log.action);
        });
        return Array.from(actions).sort();
    };

    // Log an error message
    const error = async (action, message) => {
        if (!isBrowser) {
            console.error(`[${action}] ${message}`);
            return null;
        }
        return await createLog({
            level: 'error',
            action,
            message
        });
    };

    // Log a warning message
    const warn = async (action, message) => {
        if (!isBrowser) {
            console.warn(`[${action}] ${message}`);
            return null;
        }
        return await createLog({
            level: 'warn',
            action,
            message
        });
    };

    // Log an info message
    const info = async (action, message) => {
        if (!isBrowser) {
            console.info(`[${action}] ${message}`);
            return null;
        }
        return await createLog({
            level: 'info',
            action,
            message
        });
    };

    // Log a debug message
    const debug = async (action, message) => {
        if (!isBrowser) {
            console.debug(`[${action}] ${message}`);
            return null;
        }
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
