export const logsOperations = {
    list: {
        type: "query",
        name: "List Logs",
        description: "Retrieves logs with pagination and filtering",
        variables: {
            page: "Page number for pagination (offset)",
            pageSize: "Number of logs per page (limit)",
            level: "Filter by log level (error, warn, info, debug)",
            action: "Filter by action",
            fromDate: "Filter by date range (start timestamp)",
            toDate: "Filter by date range (end timestamp)",
            search: "Search in log messages"
        },
        query: `query ListLogs($page: Int!, $pageSize: Int!, $level: String, $action: String, $fromDate: String, $toDate: String, $search: String) {\n  result: logs(\n    limit: $pageSize\n    offset: $page\n    where: {\n      level: { eq: $level }\n      action: { eq: $action }\n      created_at: { gte: $fromDate, lte: $toDate }\n      message: { like: $search }\n    }\n  ) {\n    id\n    created_at\n    level\n    action\n    message\n  }\n  \n  # Get total count for pagination\n  count: logs(\n    where: {\n      level: { eq: $level }\n      action: { eq: $action }\n      created_at: { gte: $fromDate, lte: $toDate }\n      message: { like: $search }\n    }\n  ) {\n    id\n  }\n}`
    },
    create: {
        type: "mutation",
        name: "Create Log",
        description: "Creates a new log entry",
        variables: {
            level: "Log level (error, warn, info, debug)",
            action: "The action that triggered the log",
            message: "Log message content"
        },
        query: `mutation CreateLog($level: String!, $action: String!, $message: String!) {\n  insertIntoLogs(values: [{\n    level: $level,\n    action: $action,\n    message: $message\n  }]) {\n    id\n    created_at\n    level\n    action\n    message\n  }\n}`
    },
    delete: {
        type: "mutation",
        name: "Delete Log",
        description: "Deletes a log entry by ID",
        variables: {
            id: "ID of the log to delete"
        },
        query: `mutation DeleteLog($id: String!) {\n  deleteFromLogs(where: { id: { eq: $id } }) {\n    id\n  }\n}`
    },
    clear: {
        type: "mutation",
        name: "Clear Logs",
        description: "Clears logs based on filters",
        variables: {
            level: "Filter by log level",
            action: "Filter by action",
            fromDate: "Filter by start date",
            toDate: "Filter by end date"
        },
        query: `mutation ClearLogs($level: String, $action: String, $fromDate: String, $toDate: String) {\n  deleteFromLogs(\n    where: {\n      level: { eq: $level }\n      action: { eq: $action }\n      created_at: { gte: $fromDate, lte: $toDate }\n    }\n  ) {\n    id\n  }\n}`
    }
}; 