export const objectsOperations = {
    // LIST
    list: {
        type: "query",
        name: "List Objects",
        description: "Retrieves all objects with optional filtering by project or institution",
        variables: {
            projectId: "Optional ID of project to filter by",
            institutionId: "Optional ID of institution to filter by"
        },
        query: `query ListObjects($projectId: String, $institutionId: String) {\n  result: objects(\n    where: {\n      project_id: { eq: $projectId }\n      institution_id: { eq: $institutionId }\n    }\n  ) {\n    id\n    status\n    created_at\n    updated_at\n    institution_id\n    project_id\n    institution {\n      id\n      name {\n        content\n      }\n    }\n    project {\n      id\n      title {\n        content\n      }\n    }\n    objectsAssets {\n      order\n      asset {\n        id\n        filename\n        path\n        type     \n      }\n    }\n  }\n}`
    },

    // GET BY ID
    getById: {
        type: "query",
        name: "Get Object by ID",
        description: "Retrieves a single object by its ID",
        variables: {
            objectId: "ID of the object to retrieve"
        },
        query: `query GetObject($objectId: String!) {\n  result: objects(where: { id: { eq: $objectId } }) {\n    id\n    status\n    created_at\n    updated_at\n    institution_id\n    project_id\n    institution {\n      id\n      name {\n        content\n      }\n    }\n    project {\n      id\n      title {\n        content\n      }\n    }\n    objectsResearchFields {\n      id\n      value\n      vocabulary_id\n      researchField {\n        id\n        name {\n          content\n        }\n        type\n      }\n      vocabulary {\n        id\n        option {\n          content\n          original_language\n          translations {\n            language_code\n            content\n          }\n        }\n        description {\n          content\n          original_language\n          translations {\n            language_code\n            content\n          }\n        }\n      }\n    }\n    objectsOntologyFields {\n      id\n      label\n      value\n      field_id\n      primary\n      ontologyField {\n        id\n        name {\n          content\n        }\n        category {\n          content\n        }\n      }\n    }\n    objectsAssets {\n      id\n      order\n      asset {\n        id\n        filename\n        path\n        type\n      }\n    }\n  }\n}`
    },

    // CREATE
    create: {
        type: "mutation",
        name: "Create Object",
        description: "Creates a new object",
        variables: {
            status: "Status of the object",
            institutionId: "ID of the institution this object belongs to",
            projectId: "ID of the project this object belongs to"
        },
        query: `mutation CreateObject($status: String, $institutionId: String!, $projectId: String!) {\n  insertIntoObjects(values: [{\n    status: $status,\n    institution_id: $institutionId,\n    project_id: $projectId\n  }]) {\n    id\n    status\n    created_at\n    updated_at\n    institution_id\n    project_id\n  }\n}`
    },

    // UPDATE
    update: {
        type: "mutation",
        name: "Update Object",
        description: "Updates an existing object by ID",
        variables: {
            objectId: "ID of the object to update",
            status: "New status of the object (optional)",
            institutionId: "New institution ID for the object (optional)",
            projectId: "New project ID for the object (optional)"
        },
        query: `mutation UpdateObject(\n  $objectId: String!,\n  $status: String,\n  $institutionId: String,\n  $projectId: String\n) {\n  updateObjects(\n    set: {\n      status: $status,\n      institution_id: $institutionId,\n      project_id: $projectId\n    }\n    where: { id: { eq: $objectId } }\n  ) {\n    id\n    status\n    updated_at\n    institution_id\n    project_id\n  }\n}`
    },

    // DELETE
    delete: {
        type: "mutation",
        name: "Delete Object",
        description: "Deletes an object by ID",
        variables: {
            objectId: "ID of the object to delete"
        },
        mutations: [
            {
                name: "getObject",
                query: `query GetObjectForDelete($objectId: String!) {\n  objects(where: { id: { eq: $objectId } }) {\n    id\n  }\n}`,
                useVariables: ["objectId"]
            },
            {
                name: "deleteObjectsAssets",
                query: `mutation DeleteObjectAssets($objectId: String!) {\n  deleteFromObjects_assets(where: { object_id: { eq: $objectId } }) {\n    id\n  }\n}`,
                useVariables: ["objectId"]
            },
            {
                name: "deleteObjectsResearchFields",
                query: `mutation DeleteObjectResearchFields($objectId: String!) {\n  deleteFromObjects_research_fields(where: { object_id: { eq: $objectId } }) {\n    id\n  }\n}`,
                useVariables: ["objectId"]
            },
            {
                name: "deleteObjectsOntologyFields",
                query: `mutation DeleteObjectOntologyFields($objectId: String!) {\n  deleteFromObjects_ontology_fields(where: { object_id: { eq: $objectId } }) {\n    id\n  }\n}`,
                useVariables: ["objectId"]
            },
            {
                name: "deleteObject",
                query: `mutation DeleteObjectFinal($objectId: String!) {\n  deleteFromObjects(where: { id: { eq: $objectId } }) {\n    id\n    status\n    institution_id\n    project_id\n  }\n}`,
                useVariables: ["objectId"]
            }
        ],
        query: null
    },

    // ASSET OPERATIONS
    addAsset: {
        type: "mutation",
        name: "Add Asset to Object",
        description: "Associates an asset with an object",
        variables: {
            objectId: "ID of the object",
            assetId: "ID of the asset to associate",
            order: "Display order for the asset (optional)"
        },
        query: `mutation AddAssetToObject($objectId: String!, $assetId: String!, $order: Int) {\n  insertIntoObjects_assets(values: [{\n    object_id: $objectId,\n    asset_id: $assetId,\n    order: $order\n  }]) {\n    id\n    object_id\n    asset_id\n    order\n  }\n}`
    },

    removeAsset: {
        type: "mutation",
        name: "Remove Asset from Object",
        description: "Removes the association between an asset and an object",
        variables: {
            objectId: "ID of the object",
            assetId: "ID of the asset to remove"
        },
        query: `mutation RemoveAssetFromObject($objectId: String!, $assetId: String!) {\n  deleteFromObjects_assets(\n    where: { \n      object_id: { eq: $objectId },\n      asset_id: { eq: $assetId }\n    }\n  ) {\n    id\n    object_id\n    asset_id\n  }\n}`
    },

    updateAssetOrder: {
        type: "mutation",
        name: "Update Asset Order",
        description: "Updates the display order of an asset associated with an object",
        variables: {
            objectId: "ID of the object",
            assetId: "ID of the asset",
            order: "New display order for the asset"
        },
        query: `mutation UpdateAssetOrder($objectId: String!, $assetId: String!, $order: Int!) {\n  updateObjects_assets(\n    set: { order: $order }\n    where: { \n      object_id: { eq: $objectId },\n      asset_id: { eq: $assetId }\n    }\n  ) {\n    id\n    object_id\n    asset_id\n    order\n  }\n}`
    },

    getAssets: {
        type: "query",
        name: "Get Object Assets",
        description: "Retrieves all assets associated with a specific object",
        variables: {
            objectId: "ID of the object"
        },
        query: `query GetObjectAssets($objectId: String!) {\n  objects_assets(\n    where: { object_id: { eq: $objectId } }\n    orderBy: { order: ASC }\n  ) {\n    id\n    order\n    asset {\n      id\n      filename\n      path\n      type\n      formats\n      properties\n      created_at\n      updated_at\n    }\n  }\n}`
    },
    objectAssignResearchField: {
        type: "mutation",
        name: "Assign Research Field to Object",
        description: "Associates an object with a research field and assigns a value or vocabulary",
        variables: {
            objectId: "ID of the object",
            fieldId: "ID of the research field to assign",
            value: "Value to store for this field (for free text)",
            vocabularyId: "ID of the vocabulary option (for vocabulary-based fields)"
        },
        query: `mutation AssignResearchField($objectId: String!, $fieldId: String!, $value: String, $vocabularyId: String) {\n  insertIntoObjects_research_fields(values: [{\n    object_id: $objectId,\n    field_id: $fieldId,\n    value: $value,\n    vocabulary_id: $vocabularyId\n  }]) {\n    id\n    object_id\n    field_id\n    value\n    vocabulary_id\n  }\n}`
    },
    objectUpdateResearchField: {
        type: "mutation",
        name: "Update Research Field Value for Object",
        description: "Updates the value or vocabulary of a research field associated with an object",
        variables: {
            objectId: "ID of the object",
            fieldId: "ID of the research field",
            value: "New value to store for this field (for free text, optional)",
            vocabularyId: "ID of the vocabulary option (for vocabulary-based fields, optional)"
        },
        query: `mutation UpdateResearchFieldValue($objectId: String!, $fieldId: String!, $value: String, $vocabularyId: String) {\n  updateObjects_research_fields(\n    set: { \n      value: $value,\n      vocabulary_id: $vocabularyId\n    }\n    where: { \n      object_id: { eq: $objectId },\n      field_id: { eq: $fieldId }\n    }\n  ) {\n    id\n    object_id\n    field_id\n    value\n    vocabulary_id\n  }\n}`
    },
    objectGetResearchFields: {
        type: "query",
        name: "Get Object Research Fields",
        description: "Retrieves all research fields associated with a specific object",
        variables: {
            objectId: "ID of the object"
        },
        query: `query GetObjectResearchFields($objectId: String!) {\n  objects_research_fields(where: { object_id: { eq: $objectId } }) {\n    id\n    value\n    vocabulary_id\n    field_id\n    researchField {\n      id\n      type\n      name {\n        content\n        translations {\n          language_code\n          content\n        }\n      }\n      description {\n        content\n      }\n      vocabularies {\n        id\n        option {\n          content\n          original_language\n          translations {\n            language_code\n            content\n          }\n        }\n        description {\n          content\n          original_language\n          translations {\n            language_code\n            content\n          }\n        }\n      }\n    }\n    vocabulary {\n      id\n      option {\n        content\n      }\n      description {\n        content\n      }\n    }\n  }\n}`
    }
}; 