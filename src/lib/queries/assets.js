export const assetsOperations = {
    list: {
        type: "query",
        name: "List Assets",
        description: "Retrieves all assets with optional filtering and pagination",
        variables: {
            page: "Page number for pagination (offset)",
            pageSize: "Number of assets per page (limit)",
            projectId: "Filter by project ID",
            institutionId: "Filter by institution ID",
            type: "Filter by asset type"
        },
        query: `query ListAssets(
  $page: Int
  $pageSize: Int
  $projectId: String
  $institutionId: String
  $type: String
) {
  result: assets(
    limit: $pageSize
    offset: $page
    where: {
      project_id: { eq: $projectId }
      institution_id: { eq: $institutionId }
      type: { eq: $type }
    }
  ) {
    id
    filename
    path
    type
    formats
    properties
    institution_id
    project_id
    created_at
    updated_at
    institution {
      id
      name {
        content
      }
    }
    project {
      id
      title {
        content
      }
    }
    objectsAssets {
      id
      object_id
    }
  }
}`
    },
    getById: {
        type: "query",
        name: "Get Asset by ID",
        description: "Retrieves a single asset by its ID",
        variables: {
            assetId: "ID of the asset to retrieve"
        },
        query: `query GetAsset($assetId: String!) {
  result: assets(where: { id: { eq: $assetId } }) {
    id
    filename
    path
    type
    formats
    properties
    institution_id
    project_id
    created_at
    updated_at
    institution {
      id
      name {
        content
      }
    }
    project {
      id
      title {
        content
      }
    }
    objectsAssets {
      id
      object_id
      object {
        id
        status
      }
    }
  }
}`
    },
    update: {
        type: "mutation",
        name: "Update Asset",
        description: "Updates an existing asset by ID",
        variables: {
            assetId: "ID of the asset to update",
            filename: "New filename (optional)",
            path: "New file path (optional)",
            type: "New asset type (optional)",
            formats: "New formats object (optional)",
            properties: "New properties object (optional)",
            institutionId: "New institution ID (optional)",
            projectId: "New project ID (optional)"
        },
        query: `mutation UpdateAsset(
  $assetId: String!
  $filename: String
  $path: String
  $type: String
  $formats: JSON
  $properties: JSON
  $institutionId: String
  $projectId: String
) {
  updateAssets(
    set: {
      filename: $filename
      path: $path
      type: $type
      formats: $formats
      properties: $properties
      institution_id: $institutionId
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
    institution_id
    project_id
    updated_at
  }
}`
    },
    delete: {
        type: "mutation",
        name: "Delete Asset",
        description: "Deletes an asset by ID",
        variables: {
            assetId: "ID of the asset to delete"
        },
        query: `mutation DeleteAsset($assetId: String!) {
  deleteFromAssets(where: { id: { eq: $assetId } }) {
    id
    filename
    path
  }
}`
    }
}; 