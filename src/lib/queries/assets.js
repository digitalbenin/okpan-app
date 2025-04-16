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
        query: `query ListAssets($page: Int, $pageSize: Int, $projectId: String, $institutionId: String, $type: String) {\n  result: assets(\n    limit: $pageSize\n    offset: $page\n    where: {\n      project_id: { eq: $projectId }\n      institution_id: { eq: $institutionId }\n      type: { eq: $type }\n    }\n  ) {\n    id\n    filename\n    path\n    type\n    formats\n    properties\n    institution_id\n    project_id\n    created_at\n    updated_at\n    institution {\n      id\n      name {\n        content\n      }\n    }\n    project {\n      id\n      title {\n        content\n      }\n    }\n    objectsAssets {\n      id\n      object_id\n    }\n  }\n}`
    },
    getById: {
        type: "query",
        name: "Get Asset by ID",
        description: "Retrieves a single asset by its ID",
        variables: {
            assetId: "ID of the asset to retrieve"
        },
        query: `query GetAsset($assetId: String!) {\n  result: assets(where: { id: { eq: $assetId } }) {\n    id\n    filename\n    path\n    type\n    formats\n    properties\n    institution_id\n    project_id\n    created_at\n    updated_at\n    institution {\n      id\n      name {\n        content\n      }\n    }\n    project {\n      id\n      title {\n        content\n      }\n    }\n    objectsAssets {\n      id\n      object_id\n      object {\n        id\n        status\n      }\n    }\n  }\n}`
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
        query: `mutation UpdateAsset(\n  $assetId: String!,\n  $filename: String,\n  $path: String,\n  $type: String,\n  $formats: JSON,\n  $properties: JSON,\n  $institutionId: String,\n  $projectId: String\n) {\n  updateAssets(\n    set: {\n      filename: $filename,\n      path: $path,\n      type: $type,\n      formats: $formats,\n      properties: $properties,\n      institution_id: $institutionId,\n      project_id: $projectId\n    }\n    where: { id: { eq: $assetId } }\n  ) {\n    id\n    filename\n    path\n    type\n    formats\n    properties\n    institution_id\n    project_id\n    updated_at\n  }\n}`
    },
    delete: {
        type: "mutation",
        name: "Delete Asset",
        description: "Deletes an asset by ID",
        variables: {
            assetId: "ID of the asset to delete"
        },
        query: `mutation DeleteAsset($assetId: String!) {\n  deleteFromAssets(where: { id: { eq: $assetId } }) {\n    id\n    filename\n    path\n  }\n}`
    }
}; 