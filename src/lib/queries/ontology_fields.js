export const ontologyFieldsOperations = {
    list: {
        type: "query",
        name: "List Ontology Fields",
        description: "Retrieves all ontology fields",
        query: `{\n  result: ontology_fields {\n    id\n    created_at\n    updated_at\n    name {\n      id\n      content\n      original_language\n      translations {\n        language_code\n        content\n      }\n    }\n    description {\n      id\n      content\n      original_language\n      translations {\n        language_code\n        content\n      }\n    }\n    category {\n      id\n      content\n      original_language\n      translations {\n        language_code\n        content\n      }\n    }\n    embeddings\n  }\n}`
    },
    getById: {
        type: "query",
        name: "Get Ontology Field by ID",
        description: "Retrieves a single ontology field by its ID",
        variables: {
            fieldId: "ID of the ontology field to retrieve"
        },
        query: `query GetOntologyField($fieldId: String!) {\n  result: ontology_fields(where: { id: { eq: $fieldId } }) {\n    id\n    created_at\n    updated_at\n    name {\n      id\n      content\n      original_language\n      translations {\n        language_code\n        content\n      }\n    }\n    description {\n      id\n      content\n      original_language\n      translations {\n        language_code\n        content\n      }\n    }\n    category {\n      id\n      content\n      original_language\n      translations {\n        language_code\n        content\n      }\n    }\n    embeddings\n  }\n}`
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
                query: `mutation CreateOntologyFieldName($name: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $name,\n    context: "ontology_fields.name",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["name", "languageCode"]
            },
            {
                name: "createDescriptionText",
                query: `mutation CreateOntologyFieldDescription($description: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $description,\n    context: "ontology_fields.description",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["description", "languageCode"]
            },
            {
                name: "createCategoryText",
                query: `mutation CreateOntologyFieldCategory($category: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $category,\n    context: "ontology_fields.category",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["category", "languageCode"]
            },
            {
                name: "createOntologyField",
                query: `mutation CreateOntologyFieldEntry($nameId: String!, $descriptionId: String!, $categoryId: String!, $embeddings: String) {\n  insertIntoOntology_fields(values: [{\n    name_id: $nameId,\n    description_id: $descriptionId,\n    category_id: $categoryId,\n    embeddings: $embeddings\n  }]) {\n    id\n    name_id\n    description_id\n    category_id\n    embeddings\n  }\n}`,
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
                query: `query GetOntologyFieldForUpdate($fieldId: String!) {\n  ontology_fields(where: { id: { eq: $fieldId } }) {\n    id\n    name_id\n    description_id\n    category_id\n    embeddings\n  }\n}`,
                useVariables: ["fieldId"]
            },
            {
                name: "updateName",
                query: `mutation UpdateOntologyFieldName($nameId: String!, $name: String!) {\n  updateTexts(\n    set: { content: $name }\n    where: { id: { eq: $nameId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["name"],
                mapVariables: {
                    nameId: { from: "getOntologyField", path: "ontology_fields.0.name_id" }
                },
                skipIf: { variableName: "name", isUndefined: true }
            },
            {
                name: "updateDescription",
                query: `mutation UpdateOntologyFieldDescription($descriptionId: String!, $description: String!) {\n  updateTexts(\n    set: { content: $description }\n    where: { id: { eq: $descriptionId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["description"],
                mapVariables: {
                    descriptionId: { from: "getOntologyField", path: "ontology_fields.0.description_id" }
                },
                skipIf: { variableName: "description", isUndefined: true }
            },
            {
                name: "updateCategory",
                query: `mutation UpdateOntologyFieldCategory($categoryId: String!, $category: String!) {\n  updateTexts(\n    set: { content: $category }\n    where: { id: { eq: $categoryId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["category"],
                mapVariables: {
                    categoryId: { from: "getOntologyField", path: "ontology_fields.0.category_id" }
                },
                skipIf: { variableName: "category", isUndefined: true }
            },
            {
                name: "updateEmbeddings",
                query: `mutation UpdateOntologyFieldEmbeddings($fieldId: String!, $embeddings: String!) {\n  updateOntology_fields(\n    set: { embeddings: $embeddings }\n    where: { id: { eq: $fieldId } }\n  ) {\n    id\n    embeddings\n  }\n}`,
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
        query: `mutation DeleteOntologyField($fieldId: String!) {\n  deleteFromOntology_fields(where: { id: { eq: $fieldId } }) {\n    id\n    name_id\n    description_id\n    category_id\n  }\n}`
    }
}; 