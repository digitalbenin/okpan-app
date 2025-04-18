export const ontologyFieldsOperations = {
    list: {
        type: "query",
        name: "List Ontology Fields",
        description: "Retrieves all ontology fields",
        query: `{
  result: ontology_fields {
    id
    created_at
    updated_at
    name {
      id
      content
      original_language
      translations {
        language_code
        content
      }
    }
    description {
      id
      content
      original_language
      translations {
        language_code
        content
      }
    }
    category {
      id
      content
      original_language
      translations {
        language_code
        content
      }
    }
    embeddings
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
    name {
      id
      content
      original_language
      translations {
        language_code
        content
      }
    }
    description {
      id
      content
      original_language
      translations {
        language_code
        content
      }
    }
    category {
      id
      content
      original_language
      translations {
        language_code
        content
      }
    }
    embeddings
  }
}`
    },
    create: {
        type: "mutation",
        name: "Create Ontology Field",
        description: "Creates a new ontology field with name, description, and category",
        variables: {
            languageCode: "Language code for the initial text",
            name: "Name of the ontology field",
            description: "Description of the ontology field",
            category: "Category of the ontology field",
            embeddings: "Embeddings data (optional)"
        },
        mutations: [
            {
                name: "createNameText",
                query: `mutation CreateOntologyFieldName($name: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $name
        context: "ontology_fields.name"
        original_language: $languageCode
      }
    ]
  ) {
    id
    content
  }
}`,
                useVariables: ["name", "languageCode"]
            },
            {
                name: "createDescriptionText",
                query: `mutation CreateOntologyFieldDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "ontology_fields.description"
        original_language: $languageCode
      }
    ]
  ) {
    id
    content
  }
}`,
                useVariables: ["description", "languageCode"]
            },
            {
                name: "createCategoryText",
                query: `mutation CreateOntologyFieldCategory($category: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $category
        context: "ontology_fields.category"
        original_language: $languageCode
      }
    ]
  ) {
    id
    content
  }
}`,
                useVariables: ["category", "languageCode"]
            },
            {
                name: "createOntologyField",
                query: `mutation CreateOntologyFieldEntry(
  $nameId: String!
  $descriptionId: String!
  $categoryId: String!
  $embeddings: String
) {
  insertIntoOntology_fields(
    values: [
      {
        name_id: $nameId
        description_id: $descriptionId
        category_id: $categoryId
        embeddings: $embeddings
      }
    ]
  ) {
    id
    name_id
    description_id
    category_id
    embeddings
  }
}`,
                useVariables: ["embeddings"],
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
            embeddings: "New embeddings data (optional)"
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
    }
}; 