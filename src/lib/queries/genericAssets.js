export const genericAssetsOperations = {
    list: {
        type: "query",
        name: "List Generic Assets",
        description: "Retrieves all generic assets with optional filtering and pagination",
        variables: {
            page: "Page number for pagination (offset)",
            pageSize: "Number of assets per page (limit)",
            projectId: "Filter by project ID",
            type: "Filter by asset type"
        },
        query: `query ListGenericAssets(
  $page: Int
  $pageSize: Int
  $projectId: String
  $type: String
) {
  result: genericAssets(
    limit: $pageSize
    offset: $page
    where: {
      project_id: { eq: $projectId }
      type: { eq: $type }
    }
  ) {
    id
    filename
    path
    type
    formats
    properties
    project_id
    created_at
    updated_at
    project {
      id
      title {
        content
      }
    }
    // vocabulariesAsMain { id } // Example if you need to list vocabularies where this is the main asset
  }
}`
    },
    getById: {
        type: "query",
        name: "Get Generic Asset by ID",
        description: "Retrieves a single generic asset by its ID",
        variables: {
            assetId: "ID of the generic asset to retrieve"
        },
        query: `query GetGenericAsset($assetId: String!) {
  result: genericAssets(where: { id: { eq: $assetId } }) {
    id
    filename
    path
    type
    formats
    properties
    project_id
    created_at
    updated_at
    project {
      id
      title {
        content
      }
    }
    // vocabulariesAsMain { id option { content } } // Example
  }
}`
    },
    update: {
        type: "mutation",
        name: "Update Generic Asset",
        description: "Updates an existing generic asset by ID",
        variables: {
            assetId: "ID of the generic asset to update",
            filename: "New filename (optional)",
            path: "New file path (optional)",
            type: "New asset type (optional)",
            formats: "New formats object (optional)",
            properties: "New properties object (optional)",
            projectId: "New project ID (optional)"
        },
        query: `mutation UpdateGenericAsset(
  $assetId: String!
  $filename: String
  $path: String
  $type: String
  $formats: JSON
  $properties: JSON
  $projectId: String
) {
  updateGenericAssets(
    set: {
      filename: $filename
      path: $path
      type: $type
      formats: $formats
      properties: $properties
      project_id: $projectId
    }
    where: { id: { eq: $assetId } }
  ) {
    id
    filename
    path
    type
    formats
    properties
    project_id
    updated_at
  }
}`
    },
    delete: {
        type: "mutation",
        name: "Delete Generic Asset",
        description: "Deletes a generic asset by ID",
        variables: {
            assetId: "ID of the generic asset to delete"
        },
        query: `mutation DeleteGenericAsset($assetId: String!) {
  result: deleteGenericAssetCascade(assetId: $assetId) {
    id
    filename
    path
    fileErrors {
      path
      error
    }
  }
}`
    }
}; 