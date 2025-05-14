export const researchFieldsOperations = {
  list: {
    type: "query",
    name: "List Research Fields",
    description: "Retrieves all research fields with optional filtering by project",
    variables: {
      projectId: "Optional ID of project to filter by"
    },
    query: `query ListResearchFields($projectId: String) {
  result: research_fields(where: { project_id: { eq: $projectId } }) {
    id
    type
    created_at
    updated_at
    project_id
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
    project {
      id
      title {
        content
      }
    }
    vocabularies {
      id
      option {
        id  
        content
      }
      description {
        id
        content
      }
      mainAsset {
        id
        filename
        path
        type
      }
      other_assets
    }
  }
}`
  },
  getById: {
    type: "query",
    name: "Get Research Field by ID",
    description: "Retrieves a single research field by its ID",
    variables: {
      fieldId: "ID of the research field to retrieve"
    },
    query: `query GetResearchField($fieldId: String!) {
  research_fields(where: { id: { eq: $fieldId } }) {
    id
    type
    created_at
    updated_at
    project_id
    name {
      id
      content
      original_language
      translations {
        id
        language_code
        content
      }
    }
    description {
      id
      content
      original_language
      translations {
        id
        language_code
        content
      }
    }
    project {
      id
      title {
        content
      }
    }
    vocabularies {
      id
      mainAsset {
        id
        filename
        formats
        path
        type
      }
      other_assets
      option {
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
    }
  }
}`
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
        query: `mutation CreateResearchFieldName($name: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $name
        context: "research_fields.name"
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
        query: `mutation CreateResearchFieldDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "research_fields.description"
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
        name: "createResearchField",
        query: `mutation CreateResearchFieldEntry(
  $nameId: String!
  $descriptionId: String!
  $projectId: String!
  $type: String
) {
  insertIntoResearch_fields(
    values: [
      {
        name_id: $nameId
        description_id: $descriptionId
        project_id: $projectId
        type: $type
      }
    ]
  ) {
    id
    type
    project_id
    name_id
    description_id
  }
}`,
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
        query: `query GetResearchFieldForUpdate($fieldId: String!) {
  research_fields(where: { id: { eq: $fieldId } }) {
    id
    name_id
    description_id
    type
  }
}`,
        useVariables: ["fieldId"]
      },
      {
        name: "updateName",
        query: `mutation UpdateResearchFieldName($nameId: String!, $name: String!) {
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
          nameId: { from: "getResearchField", path: "research_fields.0.name_id" }
        },
        skipIf: { variableName: "name", isUndefined: true }
      },
      {
        name: "updateDescription",
        query: `mutation UpdateResearchFieldDescription($descriptionId: String!, $description: String!) {
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
          descriptionId: { from: "getResearchField", path: "research_fields.0.description_id" }
        },
        skipIf: { variableName: "description", isUndefined: true }
      },
      {
        name: "updateType",
        query: `mutation UpdateResearchFieldType($fieldId: String!, $type: String!) {
  updateResearch_fields(
    set: { type: $type }
    where: { id: { eq: $fieldId } }
  ) {
    id
    type
  }
}`,
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
    query: `mutation DeleteResearchField($fieldId: String!) {
  deleteFromResearch_fields(where: { id: { eq: $fieldId } }) {
    id
    name_id
    description_id
  }
}`
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
        query: `mutation CreateVocabularyOption($option: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $option
        context: "vocabularies.option"
        original_language: $languageCode
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["option", "languageCode"]
      },
      {
        name: "createDescriptionText",
        query: `mutation CreateVocabularyDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "vocabularies.description"
        original_language: $languageCode
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["description", "languageCode"]
      },
      {
        name: "createVocabulary",
        query: `mutation CreateVocabularyEntry(
  $optionId: String!
  $descriptionId: String!
  $fieldId: String!
  $mainAsset: String
  $otherAssets: String
) {
  insertIntoVocabularies(
    values: [
      {
        option_id: $optionId
        description_id: $descriptionId
        field_id: $fieldId
        main_asset_id: $mainAsset
        other_assets: $otherAssets
      }
    ]
  ) {
    id
    option_id
    description_id
    field_id
    main_asset_id
    other_assets
  }
}`,
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
    query: `mutation DeleteVocabulary($vocabularyId: String!) {
  deleteFromVocabularies(where: { id: { eq: $vocabularyId } }) {
    id
    option_id
    description_id
    field_id
  }
}`
  }
}; 