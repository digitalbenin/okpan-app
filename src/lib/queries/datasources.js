export const datasourcesOperations = {
  // LIST
  list: {
    type: "query",
    name: "List Datasources",
    description: "Retrieves a paginated list of datasources with optional filtering by institution and sorting",
    variables: {
      institutionId: "Optional ID of institution to filter by",
      page: "Page number for pagination (0-based, default: 0)",
      pageSize: "Number of items per page (default: 10)",
      orderBy: "Field to order by (created_at, updated_at, name, default: created_at)",
      direction: "Sort direction (asc or desc, default: desc)"
    },
    query: `query ListDatasources(
  $institutionId: String
  $page: Int
  $pageSize: Int
  $orderBy: String
  $direction: String
) {
  result: datasourcesList(
    institution_id: $institutionId
    page: $page
    pageSize: $pageSize
    orderBy: $orderBy
    direction: $direction
  ) {
    id
    created_at
    updated_at
    institution_id
    language
    copyright
    contact
    date
    objectsCount # Count of linked objects
    institution {
      id
      name {
        content
      }
    }
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
    method {
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
    notes {
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
}`
  },

  // GET BY ID
  getById: {
    type: "query",
    name: "Get Datasource by ID",
    description: "Retrieves a single datasource by its ID",
    variables: {
      datasourceId: "ID of the datasource to retrieve"
    },
    query: `query GetDatasource($datasourceId: String!) {
  result: datasources(where: { id: { eq: $datasourceId } }) {
    id
    created_at
    updated_at
    institution_id
    language
    copyright
    contact
    date
    institution {
      id
      name {
        content
      }
    }
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
    method {
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
    notes {
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
    objectsOntologyFields {
      id
      label
      value
      primary
      default_description
      ontologyField {
        id
        name {
          content
        }
      }
    }
  }
}`
  },

  // CREATE
  create: {
    type: "mutation",
    name: "Create Datasource",
    description: "Creates a new datasource linked to an institution",
    variables: {
      institutionId: "ID of the institution",
      languageId: "Language ID for the initial text",
      name: "Name of the datasource",
      method: "Method description (optional)",
      notes: "Notes (optional)",
      languageId: "Language ID of the datasource (optional)",
      copyright: "Copyright information (optional)",
      contact: "Contact information (optional)",
      date: "Date (optional timestamp)"
    },
    mutations: [
      {
        name: "createNameText",
        query: `mutation CreateDatasourceName($name: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $name
        context: "datasources.name"
        original_language_id: $languageId
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["name", "languageId"]
      },
      {
        name: "createMethodText",
        query: `mutation CreateDatasourceMethod($method: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $method
        context: "datasources.method"
        original_language_id: $languageId
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["method", "languageId"],
        skipIf: { variableName: "method", isUndefined: true }
      },
      {
        name: "createNotesText",
        query: `mutation CreateDatasourceNotes($notes: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $notes
        context: "datasources.notes"
        original_language_id: $languageId
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["notes", "languageId"],
        skipIf: { variableName: "notes", isUndefined: true }
      },
      {
        name: "createDatasource",
        query: `mutation CreateDatasourceEntry(
  $nameId: String!
  $methodId: String
  $notesId: String
  $institutionId: String!
  $languageId: String
  $copyright: String
  $contact: String
  $date: Int
) {
  insertIntoDatasources(
    values: [
      {
        name_id: $nameId
        method_id: $methodId
        notes_id: $notesId
        institution_id: $institutionId
        language: $languageId
        copyright: $copyright
        contact: $contact
        date: $date
      }
    ]
  ) {
    id
    name_id
    method_id
    notes_id
    institution_id
    language
    copyright
    contact
    date
  }
}`,
        useVariables: ["institutionId", "languageId", "copyright", "contact", "date"],
        mapVariables: {
          nameId: { from: "createNameText", path: "insertIntoTexts.0.id" },
          methodId: { from: "createMethodText", path: "insertIntoTexts.0.id" },
          notesId: { from: "createNotesText", path: "insertIntoTexts.0.id" }
        }
      }
    ],
    query: null
  },

  // UPDATE (Reverted to complex version handling only default texts)
  update: {
    type: "mutation",
    name: "Update Datasource",
    description: "Updates an existing datasource, including its related text fields for the default language",
    variables: {
      datasourceId: "ID of the datasource to update",
      // Direct fields
      language: "New language code (optional)",
      contact: "New contact info (optional)",
      date: "New date as ISO string (optional)",
      copyright: "New copyright info (optional)",
      // Text fields (content for default language)
      name: "New name content (optional)",
      method: "New method content (optional)",
      notes: "New notes content (optional)",
      languageId: "Default language ID for creating new text entries (optional)",
      // Translation arrays
      nameTranslations: "Array of name translations (optional)",
      methodTranslations: "Array of method translations (optional)",
      notesTranslations: "Array of notes translations (optional)"
    },
    mutations: [
      {
        name: "getDatasource",
        query: `query GetDatasourceForUpdate($datasourceId: String!) {
  datasources(where: { id: { eq: $datasourceId } }) {
    id
    name_id
    method_id
    notes_id
  }
}`,
        useVariables: ["datasourceId"]
      },
      {
        name: "updateName",
        query: `mutation UpdateDatasourceName($nameId: String!, $name: String!) {
  updateTexts(set: { content: $name }, where: { id: { eq: $nameId } }) {
    id
  }
}`,
        useVariables: ["name"],
        mapVariables: { nameId: { from: "getDatasource", path: "datasources.0.name_id" } },
        skipIf: { variableName: "nameId", isUndefined: true }
      },
      {
        name: "updateMethod",
        query: `mutation UpdateDatasourceMethod($methodId: String!, $method: String!) {
  updateTexts(set: { content: $method }, where: { id: { eq: $methodId } }) {
    id
  }
}`,
        useVariables: ["method"],
        mapVariables: { methodId: { from: "getDatasource", path: "datasources.0.method_id" } },
        skipIf: { variableName: "methodId", isUndefined: true }
      },
      {
        name: "getDefaultLanguage",
        query: `query GetDefaultLanguage($nameId: String!) {
  texts(where: { id: { eq: $nameId } }) {
    original_language_id
  }
}`,
        useVariables: ["notes"],
        mapVariables: { nameId: { from: "getDatasource", path: "datasources.0.name_id" } },
        onlyIf: { from: "getDatasource", path: "datasources.0.notes_id", isNull: true },
        skipIf: { variableName: "notes", isUndefined: true }
      },
      {
        name: "createNotesText",
        query: `mutation CreateDatasourceNotes($notes: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $notes
        context: "datasources.notes"
        original_language_id: $languageId
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["notes"],
        mapVariables: { languageId: { from: "getDefaultLanguage", path: "texts.0.original_language_id" } },
        onlyIf: { from: "getDatasource", path: "datasources.0.notes_id", isNull: true },
        skipIf: { variableName: "notes", isUndefined: true }
      },
      {
        name: "updateNotesId",
        query: `mutation UpdateDatasourceNotesId($datasourceId: String!, $notesId: String!) {
  updateDatasources(
    set: { notes_id: $notesId }
    where: { id: { eq: $datasourceId } }
  ) {
    id
    notes_id
  }
}`,
        useVariables: ["datasourceId"],
        mapVariables: { notesId: { from: "createNotesText", path: "insertIntoTexts.0.id" } },
        onlyIf: { from: "getDatasource", path: "datasources.0.notes_id", isNull: true }
      },
      {
        name: "updateNotes",
        query: `mutation UpdateDatasourceNotes($notesId: String!, $notes: String!) {
  updateTexts(set: { content: $notes }, where: { id: { eq: $notesId } }) {
    id
  }
}`,
        useVariables: ["notes"],
        mapVariables: { notesId: { from: "getDatasource", path: "datasources.0.notes_id" } },
        onlyIf: { from: "getDatasource", path: "datasources.0.notes_id", isNull: false },
        skipIf: { variableName: "notes", isUndefined: true }
      },

      {
        name: "updateDatasourceFields",
        query: `mutation UpdateDatasourceDirectFields(
  $datasourceId: String!
  $language: String
  $contact: String
  $date: String
  $copyright: String
) {
  updateDatasources(
    set: { language: $language, contact: $contact, date: $date, copyright: $copyright }
    where: { id: { eq: $datasourceId } }
  ) {
    id
    language
    contact
    date
    copyright
  }
}`,
        useVariables: ["datasourceId", "language", "contact", "date", "copyright"],
        skipIf: {
          condition: "AND",
          variables: [
            { variableName: "language", isUndefined: true },
            { variableName: "contact", isUndefined: true },
            { variableName: "date", isUndefined: true },
            { variableName: "copyright", isUndefined: true }
          ]
        }
      },
      // === TRANSLATION PROCESSING STEPS ===
      {
        name: "processNameTranslations",
        processTranslations: {
          textIdPath: "getDatasource.datasources.0.name_id",
          translationsParam: "nameTranslations"
        }
      },
      {
        name: "processMethodTranslations",
        processTranslations: {
          textIdPath: "getDatasource.datasources.0.method_id",
          translationsParam: "methodTranslations"
        }
      },
      {
        name: "processNotesTranslations",
        processTranslations: {
          textIdPath: "getDatasource.datasources.0.notes_id",
          translationsParam: "notesTranslations"
        }
      }
    ],
    query: null
  },

  // DELETE
  delete: {
    type: "mutation",
    name: "Delete Datasource",
    description: "Deletes a datasource by ID",
    variables: {
      datasourceId: "ID of the datasource to delete"
    },
    mutations: [
      {
        name: "getDatasource",
        query: `query GetDatasourceForDelete($datasourceId: String!) {
  datasources(where: { id: { eq: $datasourceId } }) {
    id
    name_id
    method_id
    notes_id
  }
}`,
        useVariables: ["datasourceId"]
      },
      {
        name: "deleteTemplates",
        query: `mutation DeleteDatasourceTemplates($datasourceId: String!) {
  deleteFromTemplates(where: { datasource_id: { eq: $datasourceId } }) {
    id
  }
}`,
        useVariables: ["datasourceId"]
      },
      {
        name: "deleteObjectsOntologyFields", // Or potentially update them to null
        query: `mutation DeleteDatasourceOntologyLinks($datasourceId: String!) {
  deleteFromObjects_ontology_fields(where: { datasources_id: { eq: $datasourceId } }) {
    id
  }
}`,
        useVariables: ["datasourceId"]
      },
      {
        name: "deleteDatasource",
        query: `mutation DeleteDatasourceFinal($datasourceId: String!) {
  deleteFromDatasources(where: { id: { eq: $datasourceId } }) {
    id
    name_id
    method_id
    notes_id
  }
}`,
        useVariables: ["datasourceId"]
      },
      {
        name: "deleteNameText",
        query: `mutation DeleteDatasourceNameText($nameId: String!) {
  deleteFromTexts(where: { id: { eq: $nameId } }) {
    id
  }
}`,
        mapVariables: {
          nameId: { from: "getDatasource", path: "datasources.0.name_id" }
        },
        skipIf: { variableName: "nameId", isUndefined: true }
      },
      {
        name: "deleteMethodText",
        query: `mutation DeleteDatasourceMethodText($methodId: String!) {
  deleteFromTexts(where: { id: { eq: $methodId } }) {
    id
  }
}`,
        mapVariables: {
          methodId: { from: "getDatasource", path: "datasources.0.method_id" }
        },
        skipIf: { variableName: "methodId", isUndefined: true }
      },
      {
        name: "deleteNotesText",
        query: `mutation DeleteDatasourceNotesText($notesId: String!) {
  deleteFromTexts(where: { id: { eq: $notesId } }) {
    id
  }
}`,
        mapVariables: {
          notesId: { from: "getDatasource", path: "datasources.0.notes_id" }
        },
        skipIf: { variableName: "notesId", isUndefined: true }
      }
    ],
    query: null
  }
}; 