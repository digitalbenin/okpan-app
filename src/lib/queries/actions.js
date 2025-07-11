export const actionsOperations = {
  // Main actions query
  list: {
    type: "query",
    name: "List Actions",
    description: "Universal query for actions with comprehensive filtering",
    variables: {
      projectId: "Optional project ID to filter by",
      userId: "Optional user ID to filter by",
      entityType: "Optional entity type to filter by",
      entityId: "Optional entity ID to filter by",
      actionType: "Optional action type filter (CREATE, UPDATE, DELETE)",
      parentActionId: "Optional parent action ID to filter by",
      limit: "Maximum number of results (default: 20)",
      offset: "Pagination offset (default: 0)"
    },
    query: `query ListActions(
  $projectId: String
  $userId: String
  $entityType: String
  $entityId: String
  $actionType: String
  $parentActionId: String
  $limit: Int = 20
  $offset: Int = 0
) {
  result: actions(
    where: {
      project_id: { eq: $projectId }
      user_id: { eq: $userId }
      entity_type: { eq: $entityType }
      entity_id: { eq: $entityId }
      action_type: { eq: $actionType }
      parent_action_id: { eq: $parentActionId }
    }
    limit: $limit
    offset: $offset
    orderBy: { created_at: { direction: desc, priority: 1 } }
  ) {
    id
    created_at
    updated_at
    project_id
    user_id
    client_id
    action_type
    entity_type
    entity_id
    changes
    parent_action_id
    metadata
  }
}`
  },

  // Query specifically for parent actions only (those without parent_action_id)
  listVisualizableActions: {
    type: "query",
    name: "List Visualizable Actions",
    description: "Query for visualizable actions only (those without parent_action_id)",
    variables: {
      projectId: "Optional project ID to filter by",
      userId: "Optional user ID to filter by",
      entityType: "Optional entity type to filter by",
      entityId: "Optional entity ID to filter by",
      actionType: "Optional action type filter (CREATE, UPDATE, DELETE)",
      limit: "Maximum number of results (default: 20)",
      offset: "Pagination offset (default: 0)"
    },
    query: `query ListVisualizableActions(
  $projectId: String
  $userId: String
  $entityType: String
  $entityId: String
  $actionType: String
  $limit: Int = 20
  $offset: Int = 0
) {
  result: actions(
    where: {
      project_id: { eq: $projectId }
      user_id: { eq: $userId }
      entity_type: { eq: $entityType }
      entity_id: { eq: $entityId }
      action_type: { eq: $actionType }
      parent_action_id: { isNull: true }
    }
    limit: $limit
    offset: $offset
    orderBy: { created_at: { direction: desc, priority: 1 } }
  ) {
    id
    created_at
    updated_at
    project_id
    user_id
    client_id
    action_type
    entity_type
    entity_id
    changes
    parent_action_id
    metadata
  }
}`
  }
}; 