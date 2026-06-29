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
    private
    onwebsite
    fields_config
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
    description {
      id
      content
      original_language_id
      translations {
        id
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
      external_link
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
        formats
        properties
        created_at
        torrent_length
      }
      otherAssets:vocabulariesGenericAssets {
        genericAsset {
          id
          filename
          path
          type
          formats
          properties
          created_at
          torrent_length
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
    private
    onwebsite
    fields_config
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
      external_link
      created_at
      updated_at
      objectsResearchFields {
        id
      }
      mainAsset {
        id
        filename
        formats
        path
        type
        properties
        created_at
        torrent_length
      }
      vocabulariesGenericAssets {
        genericAsset {
          id
          filename
          formats
          path
          type
          properties
          created_at
          torrent_length
        }
        order
      }
      option {
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
      private: "Whether the field is private (optional, defaults to false)",
      onwebsite: "Whether to show the field on website (optional, defaults to true)",
      fieldsConfig: "Configuration for fields visibility (optional, JSON)",
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
  $private: Int
  $onwebsite: Int
  $fieldsConfig: JSON
) {
  result:insertIntoResearch_fields(
    values: [
      {
        name_id: $nameId
        description_id: $descriptionId
        project_id: $projectId
        type: $type
        private: $private
        onwebsite: $onwebsite
        fields_config: $fieldsConfig
      }
    ]
  ) {
    id
    type
    project_id
    name_id
    description_id
    private
    onwebsite
    fields_config
  }
}`,
        useVariables: ["projectId", "type", "private", "onwebsite", "fieldsConfig"],
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
      private: "Whether the field is private (optional)",
      onwebsite: "Whether to show the field on website (optional)",
      fieldsConfig: "Configuration for fields visibility (optional, JSON)",
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
    private
    onwebsite
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
        // Skip if name is undefined to avoid required variable errors
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
        // Skip if description is undefined to avoid required variable errors
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
      },
      {
        name: "updatePrivate",
        query: `mutation UpdateResearchFieldPrivate($fieldId: String!, $private: Int!) {
  updateResearch_fields(
    set: { private: $private }
    where: { id: { eq: $fieldId } }
  ) {
    id
    private
  }
}`,
        useVariables: ["fieldId", "private"],
        skipIf: { variableName: "private", isUndefined: true }
      },
      {
        name: "updateOnwebsite",
        query: `mutation UpdateResearchFieldOnwebsite($fieldId: String!, $onwebsite: Int!) {
  updateResearch_fields(
    set: { onwebsite: $onwebsite }
    where: { id: { eq: $fieldId } }
  ) {
    id
    onwebsite
  }
}`,
        useVariables: ["fieldId", "onwebsite"],
        skipIf: { variableName: "onwebsite", isUndefined: true }
      },
      {
        name: "updateFieldsConfig",
        query: `mutation UpdateResearchFieldConfig($fieldId: String!, $fieldsConfig: JSON!) {
  updateResearch_fields(
    set: { fields_config: $fieldsConfig }
    where: { id: { eq: $fieldId } }
  ) {
    id
    fields_config
  }
}`,
        useVariables: ["fieldId", "fieldsConfig"],
        skipIf: { variableName: "fieldsConfig", isUndefined: true }
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
    description: "Deletes a research field by ID (cascade deletion handled by database)",
    variables: {
      fieldId: "ID of the research field to delete"
    },
    query: `mutation DeleteResearchField($fieldId: String!) {
  result:deleteFromResearch_fields(where: { id: { eq: $fieldId } }) {
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
  $externalLink: String
) {
  insertIntoVocabularies(
    values: [
      {
        option_id: $optionId
        description_id: $descriptionId
        field_id: $fieldId
        main_asset_id: $mainAsset
        external_link: $externalLink
      }
    ]
  ) {
    id
    option_id
    description_id
    field_id
    main_asset_id
    external_link
  }
}`,
        useVariables: ["fieldId", "mainAsset", "externalLink"],
        mapVariables: {
          optionId: { from: "createOptionText", path: "insertIntoTexts.0.id" },
          descriptionId: { from: "createDescriptionText", path: "insertIntoTexts.0.id" }
        }
      },

    ],
    query: null
  },
  getVocabulariesByFieldId: {
    type: "query",
    name: "Get Vocabularies By Field ID",
    description: "Gets all vocabularies for a research field",
    variables: {
      fieldId: "ID of the research field"
    },
    query: `query GetVocabulariesByFieldId($fieldId: String!) {
  vocabularies(where: { field_id: { eq: $fieldId } }) {
    id
    main_asset_id
    vocabulariesGenericAssets {
      generic_asset_id
    }
  }
}`
  },
  getVocabularyById: {
    type: "query",
    name: "Get Vocabulary By ID",
    description: "Gets a vocabulary option by ID for processing deletions",
    variables: {
      vocabularyId: "ID of the vocabulary to retrieve"
    },
    query: `query GetVocabularyById($vocabularyId: String!) {
  vocabularies(where: { id: { eq: $vocabularyId } }) {
    id
    main_asset_id
    vocabulariesGenericAssets {
      generic_asset_id
    }
  }
}`
  },
  deleteVocabulary: {
    type: "mutation",
    name: "Delete Vocabulary from Research Field",
    description: "Deletes a vocabulary option from a research field",
    variables: {
      vocabularyId: "ID of the vocabulary to delete"
    },
    query: `mutation DeleteVocabulary($vocabularyId: String!) {
  result: deleteFromVocabularies(where: { id: { eq: $vocabularyId } }) {
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
      externalLink: "External link URL (optional)",
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
    external_link
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
        name: "updateVocabularyFields",
        query: `mutation UpdateVocabularyFields($vocabularyId: String!, $mainAsset: String, $externalLink: String) {
  updateVocabularies(
    set: { main_asset_id: $mainAsset, external_link: $externalLink }
    where: { id: { eq: $vocabularyId } }
  ) {
    id
    main_asset_id
    external_link
  }
}`,
        useVariables: ["vocabularyId", "mainAsset", "externalLink"]
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
      },
      // === FINAL RESULT STEP ===
      {
        name: "result",
        query: `query GetUpdatedVocabulary($vocabularyId: String!) {
  result: vocabularies(where: { id: { eq: $vocabularyId } }) {
    id
    option_id
    description_id
    field_id
    main_asset_id
    external_link
  }
}`,
        useVariables: ["vocabularyId"]
      }
    ],
    query: null
  },
  countObjects: {
    type: "query",
    name: "Count Objects Using Research Field",
    description: "Counts how many objects contain values from a specific research field",
    variables: {
      fieldId: "ID of the research field"
    },
    query: `query CountObjectsUsingResearchField($fieldId: String!) {
  result: researchFieldObjectsCount(fieldId: $fieldId)
}`
  }
};