export const institutionsOperations = {
    // GET BY ID - Using the custom resolver from graphqlDefs.js
    getById: {
        type: "query",
        name: "Get Institution By ID With Counts",
        description: "Retrieves a single institution by its ID with all details including counts",
        variables: {
            institutionId: "ID of the institution to retrieve"
        },
        query: `query GetInstitution($institutionId: String!) {\n  result: institutionById(institution_id: $institutionId) {\n    id\n    created_at\n    updated_at\n    project_id\n    status\n    name {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    description {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    location {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    country {\n      id\n      content\n      original_language\n      translations {\n        id\n        language_code\n        content\n      }\n    }\n    links\n    objectsCount\n    datasourcesCount\n    assetsCount\n  }\n}`
    },

    // LIST - Using the custom resolver from graphqlDefs.js
    list: {
        type: "query",
        name: "List Institutions With Counts",
        description: "Retrieves all institutions with their aggregated counts and pagination",
        variables: {
            projectId: "Optional ID of project to filter by",
            page: "Page number for pagination (0-based)",
            pageSize: "Number of items per page",
            orderBy: "Field to order by (created_at, updated_at, name)",
            direction: "Sort direction (asc or desc)"
        },
        query: `query GetInstitutionsList($projectId: String, $page: Int = 0, $pageSize: Int = 10, $orderBy: String = "created_at", $direction: String = "desc") {\n  result: institutionsList(project_id: $projectId, page: $page, pageSize: $pageSize, orderBy: $orderBy, direction: $direction) {\n    id\n    created_at\n    updated_at\n    project_id\n    status\n    name {\n      content\n      translations {\n        content\n        language_code\n      }\n    }\n    description {\n      content\n      translations {\n        content\n        language_code\n      }\n    }\n    location {\n      content\n      translations {\n        content\n        language_code\n      }\n    }\n    country {\n      content\n      translations {\n        content\n        language_code\n      }\n    }\n    links\n    objectsCount\n    datasourcesCount\n    assetsCount\n  }\n  count: institutionsCount(project_id: $projectId)\n}`
    },

    // COUNT - Using the custom resolver
    count: {
        type: "query",
        name: "Count Institutions",
        description: "Returns the total count of institutions, optionally filtered by project",
        variables: {
            projectId: "Optional ID of project to filter by"
        },
        query: `query CountInstitutions($projectId: String) {\n  result: institutionsCount(project_id: $projectId)\n}`
    },

    // CREATE
    create: {
        type: "mutation",
        name: "Create Institution",
        description: "Creates a new institution linked to a project",
        variables: {
            projectId: "ID of the project to link the institution to",
            languageCode: "Language code for the initial text",
            institutionName: "Name of the institution",
            institutionDescription: "Description of the institution",
            country: "Country of the institution",
            location: "Location of the institution",
            status: "Status of the institution"
        },
        mutations: [
            {
                name: "createNameText",
                query: `mutation CreateInstitutionName($institutionName: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $institutionName,\n    context: "institutions.name",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["institutionName", "languageCode"]
            },
            {
                name: "createDescriptionText",
                query: `mutation CreateInstitutionDescription($institutionDescription: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $institutionDescription,\n    context: "institutions.description",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["institutionDescription", "languageCode"]
            },
            {
                name: "createCountryText",
                query: `mutation CreateInstitutionCountry($country: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $country,\n    context: "institutions.country",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["country", "languageCode"]
            },
            {
                name: "createLocationText",
                query: `mutation CreateInstitutionLocation($location: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $location,\n    context: "institutions.location",\n    original_language: $languageCode\n  }]) {\n    id\n    content\n  }\n}`,
                useVariables: ["location", "languageCode"]
            },
            {
                name: "createInstitution",
                query: `mutation CreateInstitutionEntry($nameId: String!, $descriptionId: String!, $countryId: String!, $locationId: String!, $projectId: String!, $status: String) {\n  insertIntoInstitutions(values: [{\n    name_id: $nameId,\n    description_id: $descriptionId,\n    country_id: $countryId,\n    location_id: $locationId,\n    project_id: $projectId,\n    status: $status\n  }]) {\n    id\n    name_id\n    description_id\n    country_id\n    location_id\n    project_id\n    status\n  }\n}`,
                useVariables: ["projectId", "status"],
                mapVariables: {
                    nameId: { from: "createNameText", path: "insertIntoTexts.0.id" },
                    descriptionId: { from: "createDescriptionText", path: "insertIntoTexts.0.id" },
                    countryId: { from: "createCountryText", path: "insertIntoTexts.0.id" },
                    locationId: { from: "createLocationText", path: "insertIntoTexts.0.id" }
                }
            }
        ],
        query: null
    },

    // UPDATE
    update: {
        type: "mutation",
        name: "Update Institution",
        description: "Updates an existing institution by ID",
        variables: {
            institutionId: "ID of the institution to update",
            name: "New name content (optional)",
            description: "New description content (optional)",
            country: "New country content (optional)",
            location: "New location content (optional)",
            status: "New status (optional)",
            links: "New links array (optional)"
        },
        mutations: [
            {
                name: "getInstitution",
                query: `query GetInstitutionForUpdate($institutionId: String!) {\n  institutions(where: { id: { eq: $institutionId } }) {\n    id\n    name_id\n    description_id\n    country_id\n    location_id\n    status\n    links\n  }\n}`,
                useVariables: ["institutionId"]
            },
            {
                name: "updateName",
                query: `mutation UpdateInstitutionName($nameId: String!, $name: String!) {\n  updateTexts(\n    set: { content: $name }\n    where: { id: { eq: $nameId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["name"],
                mapVariables: {
                    nameId: { from: "getInstitution", path: "institutions.0.name_id" }
                },
                skipIf: { variableName: "name", isUndefined: true }
            },
            {
                name: "updateDescription",
                query: `mutation UpdateInstitutionDescription($descriptionId: String!, $description: String!) {\n  updateTexts(\n    set: { content: $description }\n    where: { id: { eq: $descriptionId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["description"],
                mapVariables: {
                    descriptionId: { from: "getInstitution", path: "institutions.0.description_id" }
                },
                skipIf: { variableName: "description", isUndefined: true }
            },
            {
                name: "updateCountry",
                query: `mutation UpdateInstitutionCountry($countryId: String!, $country: String!) {\n  updateTexts(\n    set: { content: $country }\n    where: { id: { eq: $countryId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["country"],
                mapVariables: {
                    countryId: { from: "getInstitution", path: "institutions.0.country_id" }
                },
                skipIf: { variableName: "country", isUndefined: true }
            },
            {
                name: "updateLocation",
                query: `mutation UpdateInstitutionLocation($locationId: String!, $location: String!) {\n  updateTexts(\n    set: { content: $location }\n    where: { id: { eq: $locationId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["location"],
                mapVariables: {
                    locationId: { from: "getInstitution", path: "institutions.0.location_id" }
                },
                skipIf: { variableName: "location", isUndefined: true }
            },
            {
                name: "updateStatus",
                query: `mutation UpdateInstitutionStatus($institutionId: String!, $status: String!) {\n  updateInstitutions(\n    set: { status: $status }\n    where: { id: { eq: $institutionId } }\n  ) {\n    id\n    status\n  }\n}`,
                useVariables: ["institutionId", "status"],
                skipIf: { variableName: "status", isUndefined: true }
            },
            {
                name: "updateLinks",
                query: `mutation UpdateInstitutionLinks($institutionId: String!, $links: String!) {\n  updateInstitutions(\n    set: { links: $links }\n    where: { id: { eq: $institutionId } }\n  ) {\n    id\n    links\n  }\n}`,
                useVariables: ["institutionId", "links"],
                skipIf: { variableName: "links", isUndefined: true }
            }
        ],
        query: null
    },

    // DELETE
    delete: {
        type: "mutation",
        name: "Delete Institution",
        description: "Deletes an institution by ID",
        variables: {
            institutionId: "ID of the institution to delete"
        },
        mutations: [
            {
                name: "getInstitution",
                query: `query GetInstitutionForDelete($institutionId: String!) {\n  institutions(where: { id: { eq: $institutionId } }) {\n    id\n    name_id\n    description_id\n    country_id\n    location_id\n    status\n    links\n  }\n}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteObjects",
                query: `mutation DeleteInstitutionObjects($institutionId: String!) {\n  deleteFromObjects(where: { institution_id: { eq: $institutionId } }) {\n    id\n  }\n}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteDatasources",
                query: `mutation DeleteInstitutionDatasources($institutionId: String!) {\n  deleteFromDatasources(where: { institution_id: { eq: $institutionId } }) {\n    id\n  }\n}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteAssetsRelations",
                query: `mutation DeleteInstitutionAssetsRelations($institutionId: String!) {\n  deleteFromAssets_institutions(where: { institution_id: { eq: $institutionId } }) {\n    id\n  }\n}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteInstitution",
                query: `mutation DeleteInstitutionFinal($institutionId: String!) {\n  deleteFromInstitutions(where: { id: { eq: $institutionId } }) {\n    id\n    name_id\n    description_id\n    country_id\n    location_id\n  }\n}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteNameText",
                query: `mutation DeleteInstitutionNameText($nameId: String!) {\n  deleteFromTexts(where: { id: { eq: $nameId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    nameId: { from: "getInstitution", path: "institutions.0.name_id" }
                },
                skipIf: { variableName: "nameId", isUndefined: true }
            },
            {
                name: "deleteDescriptionText",
                query: `mutation DeleteInstitutionDescriptionText($descriptionId: String!) {\n  deleteFromTexts(where: { id: { eq: $descriptionId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    descriptionId: { from: "getInstitution", path: "institutions.0.description_id" }
                },
                skipIf: { variableName: "descriptionId", isUndefined: true }
            },
            {
                name: "deleteCountryText",
                query: `mutation DeleteInstitutionCountryText($countryId: String!) {\n  deleteFromTexts(where: { id: { eq: $countryId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    countryId: { from: "getInstitution", path: "institutions.0.country_id" }
                },
                skipIf: { variableName: "countryId", isUndefined: true }
            },
            {
                name: "deleteLocationText",
                query: `mutation DeleteInstitutionLocationText($locationId: String!) {\n  deleteFromTexts(where: { id: { eq: $locationId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    locationId: { from: "getInstitution", path: "institutions.0.location_id" }
                },
                skipIf: { variableName: "locationId", isUndefined: true }
            }
        ],
        query: null
    }
}; 