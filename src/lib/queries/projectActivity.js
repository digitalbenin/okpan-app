export const projectActivityOperations = {
  list: {
    type: "query",
    name: "List Project Activity",
    description: "Lists high-level project activity feed rows for the overview page",
    variables: {
      projectId: "ID of the project",
      limit: "Maximum number of results (default: 10)"
    },
    query: `query ListProjectActivity($projectId: String!, $limit: Int = 10) {
  result: project_activity(
    where: { project_id: { eq: $projectId } }
    limit: $limit
    orderBy: { updated_at: { direction: desc, priority: 1 } }
  ) {
    id
    created_at
    updated_at
    project_id
    actor_client_id
    actor_username
    action_type
    entity_type
    entity_id
    institution_id
    institution_name
    message_key
    item_count
    summary_params
  }
}`
  }
};