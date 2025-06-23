export const actionsOperations = {
    list: {
        type: "query",
        name: "List Actions",
        description: "Lists all actions with optional filtering and paging, ordered by created_at DESC",
        variables: {
            projectId: "Filter by project ID (optional)",
            userId: "Filter by user ID (optional)",
            entityType: "Filter by entity type (optional)",
            limit: "Maximum number of results (optional)",
            offset: "Number of results to skip (optional)"
        },
        query: `query ListActions(
  $projectId: String
  $userId: String
  $entityType: String
  $limit: Int
  $offset: Int
) {
  result: actions(
    where: {
      project_id: { eq: $projectId }
      user_id: { eq: $userId }
      entity_type: { eq: $entityType }
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
  }
}`
    }
}; 