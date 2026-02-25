export const objectSearchOperations = {
  // SEARCH
  search: {
    type: "query",
    name: "Search Objects",
    description: "Advanced search for objects with ontology and research field filtering, pagination, and faceted results.",
    variables: {
      projectId: "Project ID to search within",
      ontologyFieldQueries: "Optional array of ontology text filters: {fieldId, query}",
      genericQuery: "Optional generic text query across name and fields",
      assetId: "Optional asset ID to prioritize linked objects",
      institutionIds: "Optional list of institution IDs to filter by (if empty, includes all)",
      researchFieldFilters: "Optional array of research field filters: {fieldId, query?, vocabularyIds?}",
      status: "Optional filter objects by status",
      page: "Optional page number for pagination (0-based, default 0)",
      pageSize: "Optional number of items per page (default 10)",
      orderBy: "Optional field to order by (created_at, updated_at, status; default created_at)",
      direction: "Optional sort direction (asc or desc; default desc)"
    },
    query: `query ObjectSearch(
  $projectId: String!
  $ontologyFieldQueries: JSON
  $genericQuery: String
  $assetId: String
  $institutionIds: [String!]
  $researchFieldFilters: [JSON!]
  $status: String
  $page: Int
  $pageSize: Int
  $orderBy: String
  $direction: String
  ) {
  result:objectSearch(
    project_id: $projectId
    assetId: $assetId
    ontologyFieldQueries: $ontologyFieldQueries
    genericQuery: $genericQuery
    institutionIds: $institutionIds
    researchFieldFilters: $researchFieldFilters
    status: $status
    page: $page
    pageSize: $pageSize
    orderBy: $orderBy
    direction: $direction
  ) {
    items {
      id
      name
      status
      created_at
      updated_at
      institution_id
      institution {
        id
        name {
          content
        }
      }
      project_id
      objectsAssets {
        order
        asset {
          id
          filename
          formats
          path
          type
        }
      }
      objectsOntologyFields {
        id
        value
        primary
        default_description
        ontologyField {
          id
          name {
            content
          }
        }
      }
      objectsResearchFields {
        id
        value
        vocabulary_id
        researchField {
          id
          name {
            content
          }
        }
        vocabulary {
          id
          option {
            content
          }
          mainAsset {
            id
            path
            formats
            type
          }
        }
      }
    }
    totalCount
    facets {
      institutions {
        id
        name
        count
      }
      statuses {
        id
        name
        count
      }
      researchFields {
        fieldId
        fieldName
        options {
          id
          name
          count
        }
      }
    }
  }
}`
  }
};