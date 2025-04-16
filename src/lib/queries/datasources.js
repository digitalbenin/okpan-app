export const datasourcesOperations = {
    // LIST
    list: {
        type: "query",
        name: "List Datasources",
        description: "Retrieves all datasources with optional filtering by institution",
        variables: {
            institutionId: "Optional ID of institution to filter by"
        },
        query: `query ListDatasources($institutionId: String) {\n  result: datasources(\n    where: { institution_id: { eq: $institutionId } }\n  ) {\n    id\n    created_at\n    updated_at\n    institution_id\n    language\n    copyright\n    contact\n    date\n    institution {\n      id\n      name {\n        content\n      }\n    }\n    name {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    method {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    notes {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    # Add counts later if needed via custom resolver\n  }\n}`
    },

    // GET BY ID
    getById: {
        type: "query",
        name: "Get Datasource by ID",
        description: "Retrieves a single datasource by its ID",
        variables: {
            datasourceId: "ID of the datasource to retrieve"
        },
        query: `query GetDatasource($datasourceId: String!) {\n  result: datasources(where: { id: { eq: $datasourceId } }) {\n    id\n    created_at\n    updated_at\n    institution_id\n    language\n    copyright\n    contact\n    date\n    institution {\n      id\n      name {\n        content\n      }\n    }\n    name {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    method {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    notes {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    # Add counts later if needed via custom resolver\n  }\n}`
    },

    // CREATE
    create: {
        type: "mutation",
        name: "Create Datasource",
        description: "Creates a new datasource linked to an institution",
        variables: {
            institutionId: "ID of the institution",
            languageCode: "Language code for the initial text",
            name: "Name of the datasource",
            method: "Method description (optional)",
            notes: "Notes (optional)",
            language: "Language of the datasource (optional)",
            copyright: "Copyright information (optional)",
            contact: "Contact information (optional)",
            date: "Date (optional timestamp)"
        },
        mutations: [
            {
                name: "createNameText",
                query: `mutation CreateDatasourceName($name: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $name,\n    context: "datasources.name",\n    original_language: $languageCode\n  }]) {\n    id\n  }\n}`,
                useVariables: ["name", "languageCode"]
            },
            {
                name: "createMethodText",
                query: `mutation CreateDatasourceMethod($method: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $method,\n    context: "datasources.method",\n    original_language: $languageCode\n  }]) {\n    id\n  }\n}`,
                useVariables: ["method", "languageCode"],
                skipIf: { variableName: "method", isUndefined: true }
            },
            {
                name: "createNotesText",
                query: `mutation CreateDatasourceNotes($notes: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $notes,\n    context: "datasources.notes",\n    original_language: $languageCode\n  }]) {\n    id\n  }\n}`,
                useVariables: ["notes", "languageCode"],
                skipIf: { variableName: "notes", isUndefined: true }
            },
            {
                name: "createDatasource",
                query: `mutation CreateDatasourceEntry(\n              $nameId: String!, \n              $methodId: String, \n              $notesId: String, \n              $institutionId: String!, \n              $language: String, \n              $copyright: String, \n              $contact: String, \n              $date: Int\n            ) {\n  insertIntoDatasources(values: [{\n    name_id: $nameId,\n    method_id: $methodId,\n    notes_id: $notesId,\n    institution_id: $institutionId,\n    language: $language,\n    copyright: $copyright,\n    contact: $contact,\n    date: $date\n  }]) {\n    id\n    name_id\n    method_id\n    notes_id\n    institution_id\n    language\n    copyright\n    contact\n    date\n  }\n}`,
                useVariables: ["institutionId", "language", "copyright", "contact", "date"],
                mapVariables: {
                    nameId: { from: "createNameText", path: "insertIntoTexts.0.id" },
                    methodId: { from: "createMethodText", path: "insertIntoTexts.0.id" },
                    notesId: { from: "createNotesText", path: "insertIntoTexts.0.id" }
                }
            }
        ],
        query: null
    },

    // UPDATE
    update: {
        type: "mutation",
        name: "Update Datasource",
        description: "Updates an existing datasource by ID",
        variables: {
            datasourceId: "ID of the datasource to update",
            name: "New name content (optional)",
            method: "New method content (optional)",
            notes: "New notes content (optional)",
            institutionId: "New institution ID (optional)",
            language: "New language (optional)",
            copyright: "New copyright (optional)",
            contact: "New contact (optional)",
            date: "New date (optional)"
        },
        mutations: [
            {
                name: "getDatasource",
                query: `query GetDatasourceForUpdate($datasourceId: String!) {\n  datasources(where: { id: { eq: $datasourceId } }) {\n    id\n    name_id\n    method_id\n    notes_id\n    institution_id\n    language\n    copyright\n    contact\n    date\n  }\n}`,
                useVariables: ["datasourceId"]
            },
            {
                name: "updateName",
                query: `mutation UpdateDatasourceName($nameId: String!, $name: String!) {\n  updateTexts(\n    set: { content: $name }\n    where: { id: { eq: $nameId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["name"],
                mapVariables: {
                    nameId: { from: "getDatasource", path: "datasources.0.name_id" }
                },
                skipIf: { variableName: "name", isUndefined: true }
            },
            {
                name: "updateMethod",
                query: `mutation UpdateDatasourceMethod($methodId: String!, $method: String!) {\n  updateTexts(\n    set: { content: $method }\n    where: { id: { eq: $methodId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["method"],
                mapVariables: {
                    methodId: { from: "getDatasource", path: "datasources.0.method_id" }
                },
                skipIf: { variableName: "method", isUndefined: true }
            },
            {
                name: "updateNotes",
                query: `mutation UpdateDatasourceNotes($notesId: String!, $notes: String!) {\n  updateTexts(\n    set: { content: $notes }\n    where: { id: { eq: $notesId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["notes"],
                mapVariables: {
                    notesId: { from: "getDatasource", path: "datasources.0.notes_id" }
                },
                skipIf: { variableName: "notes", isUndefined: true }
            },
            {
                name: "updateDatasourceFields",
                query: `mutation UpdateDatasourceFields(\n              $datasourceId: String!, \n              $institutionId: String, \n              $language: String, \n              $copyright: String, \n              $contact: String, \n              $date: Int\n            ) {\n  updateDatasources(\n    set: { \n      institution_id: $institutionId,\n      language: $language,\n      copyright: $copyright,\n      contact: $contact,\n      date: $date\n    }\n    where: { id: { eq: $datasourceId } }\n  ) {\n    id\n    institution_id\n    language\n    copyright\n    contact\n    date\n    updated_at\n  }\n}`,
                useVariables: ["datasourceId", "institutionId", "language", "copyright", "contact", "date"],
                // Skip update if all optional fields are undefined
                skipIf: {
                    variableNames: ["institutionId", "language", "copyright", "contact", "date"],
                    areAllUndefined: true
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
                query: `query GetDatasourceForDelete($datasourceId: String!) {\n  datasources(where: { id: { eq: $datasourceId } }) {\n    id\n    name_id\n    method_id\n    notes_id\n  }\n}`,
                useVariables: ["datasourceId"]
            },
            {
                name: "deleteTemplates",
                query: `mutation DeleteDatasourceTemplates($datasourceId: String!) {\n  deleteFromTemplates(where: { datasource_id: { eq: $datasourceId } }) {\n    id\n  }\n}`,
                useVariables: ["datasourceId"]
            },
            {
                name: "deleteObjectsOntologyFields", // Or potentially update them to null
                query: `mutation DeleteDatasourceOntologyLinks($datasourceId: String!) {\n  deleteFromObjects_ontology_fields(where: { datasources_id: { eq: $datasourceId } }) {\n    id\n  }\n}`,
                useVariables: ["datasourceId"]
            },
            {
                name: "deleteDatasource",
                query: `mutation DeleteDatasourceFinal($datasourceId: String!) {\n  deleteFromDatasources(where: { id: { eq: $datasourceId } }) {\n    id\n    name_id\n    method_id\n    notes_id\n  }\n}`,
                useVariables: ["datasourceId"]
            },
            {
                name: "deleteNameText",
                query: `mutation DeleteDatasourceNameText($nameId: String!) {\n  deleteFromTexts(where: { id: { eq: $nameId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    nameId: { from: "getDatasource", path: "datasources.0.name_id" }
                },
                skipIf: { variableName: "nameId", isUndefined: true }
            },
            {
                name: "deleteMethodText",
                query: `mutation DeleteDatasourceMethodText($methodId: String!) {\n  deleteFromTexts(where: { id: { eq: $methodId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    methodId: { from: "getDatasource", path: "datasources.0.method_id" }
                },
                skipIf: { variableName: "methodId", isUndefined: true }
            },
            {
                name: "deleteNotesText",
                query: `mutation DeleteDatasourceNotesText($notesId: String!) {\n  deleteFromTexts(where: { id: { eq: $notesId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    notesId: { from: "getDatasource", path: "datasources.0.notes_id" }
                },
                skipIf: { variableName: "notesId", isUndefined: true }
            }
        ],
        query: null
    }
}; 