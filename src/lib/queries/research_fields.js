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
      otherAssets:vocabulariesGenericAssets {
        genericAsset {
          id
          filename
          path
          type
        }
        order
      }
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
      original_language_id
      translations {
        id
        language_id
        content
        language {
          id
          code
          name
        }
      }
    }
    description {
      id
      content
      original_language_id
      translations {
        id
        language_id
        content
        language {
          id
          code
          name
        }
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
      vocabulariesGenericAssets {
        genericAsset {
          id
          filename
          formats
          path
          type
        }
        order
      }
      option {
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
      languageId: "Language ID for the initial text",
      name: "Name of the research field",
      description: "Description of the research field",
      type: "Type of the research field",
      vocabularies: "Array of vocabulary options (optional)",
      // Translation arrays for research field
      nameTranslations: "Array of name translations (optional)",
      descriptionTranslations: "Array of description translations (optional)"
    },
    mutations: [
      {
        name: "createNameText",
        query: `mutation CreateResearchFieldName($name: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $name
        context: "research_fields.name"
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
        query: `mutation CreateResearchFieldDescription($description: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "research_fields.description"
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
      // Translations will be handled in frontend after research field creation
      {
        name: "createResearchField",
        query: `mutation CreateResearchFieldEntry(
  $nameId: String!
  $descriptionId: String!
  $projectId: String!
  $type: String
) {
  result:insertIntoResearch_fields(
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
      type: "New field type (optional)",
      // Translation arrays
      nameTranslations: "Array of name translations (optional)",
      descriptionTranslations: "Array of description translations (optional)"
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
        skipIf: { variableName: "nameId", isUndefined: true }
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
        skipIf: { variableName: "descriptionId", isUndefined: true }
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
      },
      // === TRANSLATION PROCESSING STEPS ===
      {
        name: "processNameTranslations",
        processTranslations: {
          textIdPath: "getResearchField.research_fields.0.name_id",
          translationsParam: "nameTranslations"
        }
      },
      {
        name: "processDescriptionTranslations",
        processTranslations: {
          textIdPath: "getResearchField.research_fields.0.description_id",
          translationsParam: "descriptionTranslations"
        }
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
      languageId: "Language ID for the text",
      option: "Option text content",
      description: "Description text content",
      mainAsset: "Main asset identifier (optional)",
      otherAssets: "Array of generic asset IDs to associate with this vocabulary (optional)",
      // optional translation arrays for creation
      optionTranslations: "Array of option translations (optional)",
      descriptionTranslations: "Array of description translations (optional)"
    },
    mutations: [
      {
        name: "createOptionText",
        query: `mutation CreateVocabularyOption($option: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $option
        context: "vocabularies.option"
        original_language_id: $languageId
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["option", "languageId"]
      },
      {
        name: "createDescriptionText",
        query: `mutation CreateVocabularyDescription($description: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "vocabularies.description"
        original_language_id: $languageId
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["description", "languageId"]
      },
      // Vocabulary translations will be handled in frontend after vocabulary creation
      {
        name: "createVocabulary",
        query: `mutation CreateVocabularyEntry(
  $optionId: String!
  $descriptionId: String!
  $fieldId: String!
  $mainAsset: String
) {
  insertIntoVocabularies(
    values: [
      {
        option_id: $optionId
        description_id: $descriptionId
        field_id: $fieldId
        main_asset_id: $mainAsset
      }
    ]
  ) {
    id
    option_id
    description_id
    field_id
    main_asset_id
  }
}`,
        useVariables: ["fieldId", "mainAsset"],
        mapVariables: {
          optionId: { from: "createOptionText", path: "insertIntoTexts.0.id" },
          descriptionId: { from: "createDescriptionText", path: "insertIntoTexts.0.id" }
        }
      },

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
  },
  updateVocabulary: {
    type: "mutation",
    name: "Update Vocabulary in Research Field",
    description: "Updates an existing vocabulary option including its translations",
    variables: {
      vocabularyId: "ID of the vocabulary to update",
      option: "New option text content (optional)",
      description: "New description text content (optional)",
      mainAsset: "New main asset identifier (optional)",
      otherAssets: "Array of generic asset IDs to associate with this vocabulary (optional)",
      // Translation arrays
      optionTranslations: "Array of option translations (optional)",
      descriptionTranslations: "Array of description translations (optional)"
    },
    mutations: [
      {
        name: "getVocabulary",
        query: `query GetVocabularyForUpdate($vocabularyId: String!) {
  vocabularies(where: { id: { eq: $vocabularyId } }) {
    id
    option_id
    description_id
    field_id
    main_asset_id
    vocabulariesGenericAssets {
      generic_asset_id
      order
    }
  }
}`,
        useVariables: ["vocabularyId"]
      },
      {
        name: "updateOption",
        query: `mutation UpdateVocabularyOption($optionId: String!, $option: String!) {
  updateTexts(
    set: { content: $option }
    where: { id: { eq: $optionId } }
  ) {
    id
    content
  }
}`,
        useVariables: ["option"],
        mapVariables: {
          optionId: { from: "getVocabulary", path: "vocabularies.0.option_id" }
        },
        skipIf: { variableName: "option", isUndefined: true }
      },
      {
        name: "updateDescription",
        query: `mutation UpdateVocabularyDescription($descriptionId: String!, $description: String!) {
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
          descriptionId: { from: "getVocabulary", path: "vocabularies.0.description_id" }
        },
        skipIf: { variableName: "description", isUndefined: true }
      },
      {
        name: "updateVocabularyAssets",
        query: `mutation UpdateVocabularyAssets($vocabularyId: String!, $mainAsset: String) {
  updateVocabularies(
    set: { main_asset_id: $mainAsset }
    where: { id: { eq: $vocabularyId } }
  ) {
    id
    main_asset_id
  }
}`,
        useVariables: ["vocabularyId", "mainAsset"]
        // Removed skipIf condition to allow null values for asset removal
      },
      // === TRANSLATION PROCESSING STEPS ===
      {
        name: "processOptionTranslations",
        processTranslations: {
          textIdPath: "getVocabulary.vocabularies.0.option_id",
          translationsParam: "optionTranslations"
        }
      },
      {
        name: "processDescriptionTranslations",
        processTranslations: {
          textIdPath: "getVocabulary.vocabularies.0.description_id",
          translationsParam: "descriptionTranslations"
        }
      }
    ],
    query: null
  }
}; 