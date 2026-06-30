export const ontologyFieldsOperations = {
  list: {
    type: "query",
    name: "List Ontology Fields",
    description: "Retrieves all ontology fields for a specific project",
    variables: {
      projectId: "ID of the project to filter ontology fields"
    },
    query: `query ListOntologyFields($projectId: String!) {
  result: ontology_fields(where: { project_id: { eq: $projectId } }) {
    id
    created_at
    updated_at
    project_id
    name {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    description {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    category {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    embeddings
    onwebsite
  }
}`
  },
  getById: {
    type: "query",
    name: "Get Ontology Field by ID",
    description: "Retrieves a single ontology field by its ID",
    variables: {
      fieldId: "ID of the ontology field to retrieve"
    },
    query: `query GetOntologyField($fieldId: String!) {
  result: ontology_fields(where: { id: { eq: $fieldId } }) {
    id
    created_at
    updated_at
    project_id
    name {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    description {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    category {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    embeddings
    onwebsite
  }
}`
  },
  create: {
    type: "mutation",
    name: "Create Ontology Field",
    description: "Creates a new ontology field with name, description, and category",
    variables: {
      languageId: "Language ID for the initial text",
      projectId: "ID of the project this ontology field belongs to",
      name: "Name of the ontology field",
      description: "Description of the ontology field",
      category: "Category of the ontology field",
      embeddings: "Embeddings data (optional)",
      onwebsite: "Whether field should be visible on website (optional, defaults to 0)"
    },
    mutations: [
      {
        name: "createNameText",
        query: `mutation CreateOntologyFieldName($name: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $name
        context: "ontology_fields.name"
        original_language_id: $languageId
      }
    ]
  ) {
    id
    content
  }
}`,
        useVariables: ["name", "languageId"]
      },
      {
        name: "createDescriptionText",
        query: `mutation CreateOntologyFieldDescription($description: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "ontology_fields.description"
        original_language_id: $languageId
      }
    ]
  ) {
    id
    content
  }
}`,
        useVariables: ["description", "languageId"]
      },
      {
        name: "createCategoryText",
        query: `mutation CreateOntologyFieldCategory($category: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $category
        context: "ontology_fields.category"
        original_language_id: $languageId
      }
    ]
  ) {
    id
    content
  }
}`,
        useVariables: ["category", "languageId"]
      },
      {
        name: "createOntologyField",
        query: `mutation CreateOntologyFieldEntry(
  $nameId: String!
  $descriptionId: String!
  $categoryId: String!
  $projectId: String!
  $embeddings: String
  $onwebsite: Int
) {
  insertIntoOntology_fields(
    values: [
      {
        name_id: $nameId
        description_id: $descriptionId
        category_id: $categoryId
        project_id: $projectId
        embeddings: $embeddings
        onwebsite: $onwebsite
      }
    ]
  ) {
    id
    name_id
    description_id
    category_id
    project_id
    embeddings
    onwebsite
  }
}`,
        useVariables: ["projectId", "embeddings", "onwebsite"],
        mapVariables: {
          nameId: { from: "createNameText", path: "insertIntoTexts.0.id" },
          descriptionId: { from: "createDescriptionText", path: "insertIntoTexts.0.id" },
          categoryId: { from: "createCategoryText", path: "insertIntoTexts.0.id" }
        }
      }
    ],
    query: null
  },
  update: {
    type: "mutation",
    name: "Update Ontology Field",
    description: "Updates an existing ontology field",
    variables: {
      fieldId: "ID of the ontology field to update",
      name: "New name content (optional)",
      description: "New description content (optional)",
      category: "New category content (optional)",
      embeddings: "New embeddings data (optional)",
      onwebsite: "New onwebsite value (optional)"
    },
    mutations: [
      {
        name: "getOntologyField",
        query: `query GetOntologyFieldForUpdate($fieldId: String!) {
  ontology_fields(where: { id: { eq: $fieldId } }) {
    id
    name_id
    description_id
    category_id
    embeddings
    onwebsite
  }
}`,
        useVariables: ["fieldId"]
      },
      {
        name: "updateName",
        query: `mutation UpdateOntologyFieldName($nameId: String!, $name: String!) {
  updateTexts(
    set: { content: $name }
    where: { id: { eq: $nameId } }
  ) {
    id
    content
  }
}`,
        useVariables: ["name"],
        mapVariables: {
          nameId: { from: "getOntologyField", path: "ontology_fields.0.name_id" }
        },
        skipIf: { variableName: "name", isUndefined: true }
      },
      {
        name: "updateDescription",
        query: `mutation UpdateOntologyFieldDescription($descriptionId: String!, $description: String!) {
  updateTexts(
    set: { content: $description }
    where: { id: { eq: $descriptionId } }
  ) {
    id
    content
  }
}`,
        useVariables: ["description"],
        mapVariables: {
          descriptionId: { from: "getOntologyField", path: "ontology_fields.0.description_id" }
        },
        skipIf: { variableName: "description", isUndefined: true }
      },
      {
        name: "updateCategory",
        query: `mutation UpdateOntologyFieldCategory($categoryId: String!, $category: String!) {
  updateTexts(
    set: { content: $category }
    where: { id: { eq: $categoryId } }
  ) {
    id
    content
  }
}`,
        useVariables: ["category"],
        mapVariables: {
          categoryId: { from: "getOntologyField", path: "ontology_fields.0.category_id" }
        },
        skipIf: { variableName: "category", isUndefined: true }
      },
      {
        name: "updateEmbeddings",
        query: `mutation UpdateOntologyFieldEmbeddings($fieldId: String!, $embeddings: String!) {
  updateOntology_fields(
    set: { embeddings: $embeddings }
    where: { id: { eq: $fieldId } }
  ) {
    id
    embeddings
  }
}`,
        useVariables: ["fieldId", "embeddings"],
        skipIf: { variableName: "embeddings", isUndefined: true }
      },
      {
        name: "updateOnwebsite",
        query: `mutation UpdateOntologyFieldOnwebsite($fieldId: String!, $onwebsite: Int!) {
  updateOntology_fields(
    set: { onwebsite: $onwebsite }
    where: { id: { eq: $fieldId } }
  ) {
    id
    onwebsite
  }
}`,
        useVariables: ["fieldId", "onwebsite"],
        skipIf: { variableName: "onwebsite", isUndefined: true }
      }
    ],
    query: null
  },
  delete: {
    type: "mutation",
    name: "Delete Ontology Field",
    description: "Deletes an ontology field by ID",
    variables: {
      fieldId: "ID of the ontology field to delete"
    },
    query: `mutation DeleteOntologyField($fieldId: String!) {
  deleteFromOntology_fields(where: { id: { eq: $fieldId } }) {
    id
    name_id
    description_id
    category_id
  }
}`
  },
  byInstitution: {
    type: "query",
    name: "Ontology Fields By Institution",
    description: "Returns ontology fields used by a specific institution's datasources",
    variables: {
      projectId: "ID of the project",
      institutionId: "ID of the institution"
    },
    query: `query OntologyFieldsByInstitution($projectId: String!, $institutionId: String!) {
  result: ontologyFieldsByInstitution(projectId: $projectId, institutionId: $institutionId) {
    id
    created_at
    updated_at
    project_id
    name {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    description {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    category {
      id
      content
      original_language_id
      translations {
        language_id
        content
      }
    }
    embeddings
    onwebsite
  }
}`
  }
}; 