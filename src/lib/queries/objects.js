export const objectsOperations = {
  // LIST
  list: {
    type: "query",
    name: "List Objects",
    description: "Retrieves all objects with optional filtering, pagination, and sorting, along with the total count of filtered items.",
    variables: {
      projectId: "Optional ID of project to filter by",
      institutionId: "Optional ID of institution to filter by",
      status: "Optional status to filter objects by",
      search: "Optional search term for status (case-insensitive)",
      page: "Optional page number for pagination (0-based, default 0)",
      pageSize: "Optional number of items per page (default 10)",
      orderBy: "Optional field to order by (created_at, updated_at, status; default created_at)",
      direction: "Optional sort direction (asc or desc; default desc)"
    },
    query: `query ListObjects(
  $projectId: String
  $institutionId: String
  $status: String
  $search: String
  $page: Int
  $pageSize: Int
  $orderBy: String
  $direction: String
) {
  result: objectsList(
    project_id: $projectId
    institution_id: $institutionId
    status: $status
    search: $search
    page: $page
    pageSize: $pageSize
    orderBy: $orderBy
    direction: $direction
  ) {
    items {
      id
      status
      created_at
      updated_at
      institution_id
      project_id
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
        ontologyField {
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
        }
      }
      displayFields
    }
    totalCount
  }
}`
  },

  // GET BY ID
  getById: {
    type: "query",
    name: "Get Object by ID",
    description: "Retrieves a single object by its ID",
    variables: {
      objectId: "ID of the object to retrieve"
    },
    query: `query GetObject($objectId: String!) {
  result: objects(where: { id: { eq: $objectId } }) {
    id
    status
    created_at
    updated_at
    institution_id
    project_id
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
    objectsResearchFields {
      id
      value
      vocabulary_id
      researchField {
        id
        name {
          content
        }
        type
      }
      vocabulary {
        id
        option {
          content
          original_language_id
          translations {
            language_id
            content
          }
        }
        description {
          content
          original_language_id
          translations {
            language_id
            content
          }
        }
      }
    }
    objectsOntologyFields {
      id
      label
      value
      field_id
      primary
      default_description
      ontologyField {
        id
        name {
          content
        }
        category {
          content
        }
      }
    }
    objectsAssets {
      id
      order
      asset {
        id
        filename
        path
        type
      }
    }
  }
}`
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
    query: `mutation CreateObject($status: String, $institutionId: String!, $projectId: String!) {
  insertIntoObjects(
    values: [
      {
        status: $status
        institution_id: $institutionId
        project_id: $projectId
      }
    ]
  ) {
    id
    status
    created_at
    updated_at
    institution_id
    project_id
  }
}`
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
    query: `mutation UpdateObject(
  $objectId: String!
  $status: String
  $institutionId: String
  $projectId: String
) {
  updateObjects(
    set: {
      status: $status
      institution_id: $institutionId
      project_id: $projectId
    }
    where: { id: { eq: $objectId } }
  ) {
    id
    status
    updated_at
    institution_id
    project_id
  }
}`
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
        query: `query GetObjectForDelete($objectId: String!) {
  objects(where: { id: { eq: $objectId } }) {
    id
  }
}`,
        useVariables: ["objectId"]
      },
      {
        name: "deleteObjectsAssets",
        query: `mutation DeleteObjectAssets($objectId: String!) {
  deleteFromObjects_assets(where: { object_id: { eq: $objectId } }) {
    id
  }
}`,
        useVariables: ["objectId"]
      },
      {
        name: "deleteObjectsResearchFields",
        query: `mutation DeleteObjectResearchFields($objectId: String!) {
  deleteFromObjects_research_fields(where: { object_id: { eq: $objectId } }) {
    id
  }
}`,
        useVariables: ["objectId"]
      },
      {
        name: "deleteObjectsOntologyFields",
        query: `mutation DeleteObjectOntologyFields($objectId: String!) {
  deleteFromObjects_ontology_fields(where: { object_id: { eq: $objectId } }) {
    id
  }
}`,
        useVariables: ["objectId"]
      },
      {
        name: "deleteObject",
        query: `mutation DeleteObjectFinal($objectId: String!) {
  deleteFromObjects(where: { id: { eq: $objectId } }) {
    id
    status
    institution_id
    project_id
  }
}`,
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
    query: `mutation AddAssetToObject($objectId: String!, $assetId: String!, $order: Int) {
  insertIntoObjects_assets(
    values: [
      {
        object_id: $objectId
        asset_id: $assetId
        order: $order
      }
    ]
  ) {
    id
    object_id
    asset_id
    order
  }
}`
  },

  removeAsset: {
    type: "mutation",
    name: "Remove Asset from Object",
    description: "Removes the association between an asset and an object",
    variables: {
      objectId: "ID of the object",
      assetId: "ID of the asset to remove"
    },
    query: `mutation RemoveAssetFromObject($objectId: String!, $assetId: String!) {
  deleteFromObjects_assets(
    where: { object_id: { eq: $objectId }, asset_id: { eq: $assetId } }
  ) {
    id
    object_id
    asset_id
  }
}`
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
    query: `mutation UpdateAssetOrder($objectId: String!, $assetId: String!, $order: Int!) {
  updateObjects_assets(
    set: { order: $order }
    where: { object_id: { eq: $objectId }, asset_id: { eq: $assetId } }
  ) {
    id
    object_id
    asset_id
    order
  }
}`
  },

  getAssets: {
    type: "query",
    name: "Get Object Assets",
    description: "Retrieves all assets associated with a specific object",
    variables: {
      objectId: "ID of the object"
    },
    query: `query GetObjectAssets($objectId: String!) {
  objects_assets(
    where: { object_id: { eq: $objectId } }
    orderBy: { order: ASC }
  ) {
    id
    order
    asset {
      id
      filename
      path
      type
      formats
      properties
      created_at
      updated_at
    }
  }
}`
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
    query: `mutation AssignResearchField(
  $objectId: String!
  $fieldId: String!
  $value: String
  $vocabularyId: String
) {
  insertIntoObjects_research_fields(
    values: [
      {
        object_id: $objectId
        field_id: $fieldId
        value: $value
        vocabulary_id: $vocabularyId
      }
    ]
  ) {
    id
    object_id
    field_id
    value
    vocabulary_id
  }
}`
  },
  objectUpdateResearchField: {
    type: "mutation",
    name: "Update Research Field Value for Object",
    description: "Updates the value or vocabulary of a research field associated with an object",
    variables: {
      fieldId: "ID of the research field",
      value: "New value to store for this field (for free text, optional)",
      vocabularyId: "ID of the vocabulary option (for vocabulary-based fields, optional)"
    },
    query: `mutation UpdateResearchFieldValue(
  $fieldId: String!
  $value: String
  $vocabularyId: String
) {
  result: updateObjects_research_fields(
    set: { value: $value, vocabulary_id: $vocabularyId }
    where: { id: { eq: $fieldId } }
  ) {
    id
    object_id
    field_id
    value
    vocabulary_id
  }
}`
  },
  objectGetResearchFields: {
    type: "query",
    name: "Get Object Research Fields",
    description: "Retrieves all research fields associated with a specific object",
    variables: {
      objectId: "ID of the object"
    },
    query: `query GetObjectResearchFields($objectId: String!) {
  objects_research_fields(where: { object_id: { eq: $objectId } }) {
    id
    value
    vocabulary_id
    field_id
    researchField {
      id
      type
      name {
        content
        translations {
          language_id
          content
        }
      }
      description {
        content
      }
      vocabularies {
        id
        option {
          content
          original_language_id
          translations {
            language_id
            content
          }
        }
        description {
          content
          original_language_id
          translations {
            language_id
            content
          }
        }
      }
    }
    vocabulary {
      id
      option {
        content
      }
      description {
        content
      }
    }
  }
}`
  },

  // UPDATE ONTOLOGY FIELD
  updateOntologyField: {
    type: "mutation",
    name: "Update Object Ontology Field",
    description: "Updates a specific ontology field value for an object",
    variables: {
      objectFieldId: "ID of the object ontology field to update",
      value: "New value for the ontology field"
    },
    query: `mutation UpdateObjectOntologyField(
  $objectFieldId: String!
  $value: String
) {
  result: updateObjects_ontology_fields(
    set: { value: $value }
    where: { id: { eq: $objectFieldId } }
  ) {
    id
    value
    object_id
    field_id
  }
}`
  }
}; 