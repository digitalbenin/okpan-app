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
        query: `query ListLogs(
  $page: Int!
  $pageSize: Int!
  $level: String
  $action: String
  $fromDate: String
  $toDate: String
  $search: String
) {
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
        query: `mutation CreateLog($level: String!, $action: String!, $message: String!) {
  result: insertIntoLogs(
    values: [
      { level: $level, action: $action, message: $message }
    ]
  ) {
    id
    created_at
    level
    action
    message
  }
}`
    },
    delete: {
        type: "mutation",
        name: "Delete Log",
        description: "Deletes a log entry by ID",
        variables: {
            id: "ID of the log to delete"
        },
        query: `mutation DeleteLog($id: String!) {
  result: deleteFromLogs(where: { id: { eq: $id } }) {
    id
  }
}`
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
        query: `mutation ClearLogs(
  $level: String
  $action: String
  $fromDate: String
  $toDate: String
) {
  result: deleteFromLogs(
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
    }
  ) {
    id
  }
}`
    }
}; 