export const researchFieldsOperations = {
    list: {
        type: "query",
        name: "List Research Fields",
        description: "Retrieves all research fields with optional filtering by project",
        variables: {
            projectId: "Optional ID of project to filter by"
        },
        query: `query ListResearchFields($projectId: String) {\n  research_fields(\n    where: { project_id: { eq: $projectId } }\n  ) {\n    id\n    type\n    created_at\n    updated_at\n    project_id\n    name {\n      id\n      content\n      original_language\n      translations {\n        language_code\n        content\n      }\n    }\n    description {\n      id\n      content\n      original_language\n      translations {\n        language_code\n        content\n      }\n    }\n    project {\n      id\n      title {\n        content\n      }\n    }\n    vocabularies {\n      id\n      option {\n        content\n      }\n      description {\n        content\n      }\n    }\n  }\n}`
    },
    getById: {
        type: "query",
        name: "Get Research Field by ID",
        description: "Retrieves a single research field by its ID",
        variables: {
            fieldId: "ID of the research field to retrieve"
        },
        query: `query GetResearchField($fieldId: String!) {\n  research_fields(where: { id: { eq: $fieldId } }) {\n    id\n    type\n    created_at\n    updated_at\n    project_id\n    name {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    description {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    project {\n      id\n      title {\n        content\n      }\n    }\n    vocabularies {\n      id\n      main_asset\n      other_assets\n      option {\n        id\n        content\n        original_language\n        translations {\n          language_code\n          content\n        }\n      }\n      description {\n        id\n        content\n        original_language\n        translations {\n          language_code\n          content\n        }\n      }\n    }\n  }\n}`
    },
    create: {
        type: "mutation",
        name: "Create Research Field",
        description: "Creates a new research field with name and description",
        variables: {
            projectId: "ID of the project this field belongs to",
            languageCode: "Language code for the initial text",
            name: "Name of the research field",
            description: "Description of the research field",
            type: "Type of the research field"
        },
        mutations: [
            {
                name: "createNameText",
                query: `mutation CreateResearchFieldName($name: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $name,\n    context: "research_fields.name",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["name", "languageCode"]
            },
            {
                name: "createDescriptionText",
                query: `mutation CreateResearchFieldDescription($description: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $description,\n    context: "research_fields.description",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["description", "languageCode"]
            },
            {
                name: "createResearchField",
                query: `mutation CreateResearchFieldEntry($nameId: String!, $descriptionId: String!, $projectId: String!, $type: String) {\n  insertIntoResearch_fields(values: [{\n    name_id: $nameId,\n    description_id: $descriptionId,\n    project_id: $projectId,\n    type: $type\n  }]) {\n    id\n    type\n    project_id\n    name_id\n    description_id\n  }\n}`,
                useVariables: ["projectId", "type"],
                mapVariables: {
                    nameId: { from: "createNameText", path: "insertIntoTexts.0.id" },
                    descriptionId: { from: "createDescriptionText", path: "insertIntoTexts.0.id" }
                }
            }
        ],
        query: null
    },
    update: {
        type: "mutation",
        name: "Update Research Field",
        description: "Updates an existing research field",
        variables: {
            fieldId: "ID of the research field to update",
            name: "New name content (optional)",
            description: "New description content (optional)",
            type: "New field type (optional)"
        },
        mutations: [
            {
                name: "getResearchField",
                query: `query GetResearchFieldForUpdate($fieldId: String!) {\n  research_fields(where: { id: { eq: $fieldId } }) {\n    id\n    name_id\n    description_id\n    type\n  }\n}`,
                useVariables: ["fieldId"]
            },
            {
                name: "updateName",
                query: `mutation UpdateResearchFieldName($nameId: String!, $name: String!) {\n  updateTexts(\n    set: { content: $name }\n    where: { id: { eq: $nameId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["name"],
                mapVariables: {
                    nameId: { from: "getResearchField", path: "research_fields.0.name_id" }
                },
                skipIf: { variableName: "name", isUndefined: true }
            },
            {
                name: "updateDescription",
                query: `mutation UpdateResearchFieldDescription($descriptionId: String!, $description: String!) {\n  updateTexts(\n    set: { content: $description }\n    where: { id: { eq: $descriptionId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["description"],
                mapVariables: {
                    descriptionId: { from: "getResearchField", path: "research_fields.0.description_id" }
                },
                skipIf: { variableName: "description", isUndefined: true }
            },
            {
                name: "updateType",
                query: `mutation UpdateResearchFieldType($fieldId: String!, $type: String!) {\n  updateResearch_fields(\n    set: { type: $type }\n    where: { id: { eq: $fieldId } }\n  ) {\n    id\n    type\n  }\n}`,
                useVariables: ["fieldId", "type"],
                skipIf: { variableName: "type", isUndefined: true }
            }
        ],
        query: null
    },
    delete: {
        type: "mutation",
        name: "Delete Research Field",
        description: "Deletes a research field by ID",
        variables: {
            fieldId: "ID of the research field to delete"
        },
        query: `mutation DeleteResearchField($fieldId: String!) {\n  deleteFromResearch_fields(where: { id: { eq: $fieldId } }) {\n    id\n    name_id\n    description_id\n  }\n}`
    },
    addVocabulary: {
        type: "mutation",
        name: "Add Vocabulary to Research Field",
        description: "Adds a vocabulary option to a research field",
        variables: {
            fieldId: "ID of the research field",
            languageCode: "Language code for the text",
            option: "Option text content",
            description: "Description text content",
            mainAsset: "Main asset identifier (optional)",
            otherAssets: "JSON of other assets (optional)"
        },
        mutations: [
            {
                name: "createOptionText",
                query: `mutation CreateVocabularyOption($option: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $option,\n    context: "vocabularies.option",\n    original_language: $languageCode\n  }]) {\n    id\n  }\n}`,
                useVariables: ["option", "languageCode"]
            },
            {
                name: "createDescriptionText",
                query: `mutation CreateVocabularyDescription($description: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $description,\n    context: "vocabularies.description",\n    original_language: $languageCode\n  }]) {\n    id\n  }\n}`,
                useVariables: ["description", "languageCode"]
            },
            {
                name: "createVocabulary",
                query: `mutation CreateVocabularyEntry($optionId: String!, $descriptionId: String!, $fieldId: String!, $mainAsset: String, $otherAssets: String) {\n  insertIntoVocabularies(values: [{\n    option_id: $optionId,\n    description_id: $descriptionId,\n    field_id: $fieldId,\n    main_asset: $mainAsset,\n    other_assets: $otherAssets\n  }]) {\n    id\n    option_id\n    description_id\n    field_id\n    main_asset\n    other_assets\n  }\n}`,
                useVariables: ["fieldId", "mainAsset", "otherAssets"],
                mapVariables: {
                    optionId: { from: "createOptionText", path: "insertIntoTexts.0.id" },
                    descriptionId: { from: "createDescriptionText", path: "insertIntoTexts.0.id" }
                }
            }
        ],
        query: null
    },
    deleteVocabulary: {
        type: "mutation",
        name: "Delete Vocabulary from Research Field",
        description: "Deletes a vocabulary option from a research field",
        variables: {
            vocabularyId: "ID of the vocabulary to delete"
        },
        query: `mutation DeleteVocabulary($vocabularyId: String!) {\n  deleteFromVocabularies(where: { id: { eq: $vocabularyId } }) {\n    id\n    option_id\n    description_id\n    field_id\n  }\n}`
    }
}; 