export const entitySearchOperations = {
    search: {
        type: "query",
        name: "Entity Search",
        description: "Searches across institutions, assets, and objects using a unified search interface",
        variables: {
            query: "Search term to find entities across different types",
            projectId: "Optional project ID to filter results",
            limit: "Maximum number of results to return (default: 50)"
        },
        query: `query EntitySearch(
  $query: String!
  $projectId: String
  $limit: Int
) {
  result: entitySearch(
    query: $query
    project_id: $projectId
    limit: $limit
  ) {
    results {
      type
      id
      title
      subtitle
      project_id
      institution_id
    }
  }
}`
    }
}; 