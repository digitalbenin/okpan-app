export const assetsOperations = {
  list: {
    type: "query",
    name: "List Assets",
    description: "Retrieves all assets with optional filtering, sorting, and pagination, along with the total count of filtered items.",
    variables: {
      page: "Page number for pagination (0-based)",
      pageSize: "Number of assets per page",
      projectId: "Filter by project ID",
      institutionId: "Filter by institution ID",
      type: "Filter by asset type",
      search: "Search term for filename or path",
      orderBy: "Field to order by (e.g., created_at, filename)",
      direction: "Sort direction (asc or desc)"
    },
    query: `query ListAssets(
  $page: Int
  $pageSize: Int
  $projectId: String
  $institutionId: String
  $type: String
  $search: String
  $orderBy: String
  $direction: String
) {
  result: assetsList(
    page: $page
    pageSize: $pageSize
    project_id: $projectId
    institution_id: $institutionId
    type: $type
    search: $search
    orderBy: $orderBy
    direction: $direction
  ) {
    items {
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
          id
          content
          original_language_id
          translations {
            id
            language_id
            content
          }
        }
      }
      project {
        id
        title {
          id
          content
          original_language_id
          translations {
            id
            language_id
            content
          }
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
    totalCount
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
        name
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
  },
  deleteBulk: {
    type: "mutation",
    name: "Delete Assets (Bulk)",
    description: "Deletes multiple assets and removes their files from disk.",
    variables: {
      ids: "Array of asset IDs to delete"
    },
    query: `mutation DeleteAssetsBulk($ids: [String!]!) {
  result: deleteAssetsBulk(ids: $ids) {
    deletedIds
    missingIds
    fileErrors {
      asset_id
      path
      error
    }
  }
}`
  },

  // BULK LINK: associate multiple assets with multiple objects
  linkObjectsBulk: {
    type: "mutation",
    name: "Link Assets To Objects (Bulk)",
    description: "Bulk associate multiple assets with multiple objects",
    variables: {
      links: "Array of { asset_id: String!, object_ids: [String!]! }"
    },
    query: `mutation LinkAssetsToObjectsBulk($links: [AssetObjectsLinkInput!]!) {
  result: linkAssetsToObjectsBulk(links: $links) {
    successes { asset_id object_id }
    skippedDuplicates { asset_id object_id }
    errors { asset_id object_id error }
  }
}`
  },

  // GET LOCAL STATES
  getLocalStates: {
    type: "query",
    name: "Get Asset Local States",
    description: "Retrieves local sync statuses (missing, downloading, available) for all assets in a project.",
    variables: {
      projectId: "Filter by project ID"
    },
    query: `query GetAssetStates($projectId: String!) {
  assets(where: { project_id: { eq: $projectId } }) {
    id
    localState {
      sync_status
      download_progress
      sync_error
    }
  }
  genericAssets(where: { project_id: { eq: $projectId } }) {
    id
    localState {
      sync_status
      download_progress
      sync_error
    }
  }
}`
  }
};