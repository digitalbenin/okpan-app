export const institutionsOperations = {
    // GET BY ID - Using the custom resolver from graphqlDefs.js
    getById: {
        type: "query",
        name: "Get Institution By ID With Counts",
        description: "Retrieves a single institution by its ID with all details including counts",
        variables: {
            institutionId: "ID of the institution to retrieve"
        },
        query: `query GetInstitution($institutionId: String!) {
  result: institutionById(institution_id: $institutionId) {
    id
    created_at
    updated_at
    project_id
    status
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
    location {
      id
      content
      original_language
      translations {
        id
        language_code
        content
      }
    }
    country {
      id
      content
      original_language
      translations {
        id
        language_code
        content
      }
    }
    links
    objectsCount
    datasourcesCount
    assetsCount
  }
}`
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
        query: `query GetInstitutionsList(
  $projectId: String
  $page: Int = 0
  $pageSize: Int = 10
  $orderBy: String = "created_at"
  $direction: String = "desc"
) {
  result: institutionsList(
    project_id: $projectId
    page: $page
    pageSize: $pageSize
    orderBy: $orderBy
    direction: $direction
  ) {
    id
    created_at
    updated_at
    project_id
    status
    name {
      content
      translations {
        content
        language_code
      }
    }
    description {
      content
      translations {
        content
        language_code
      }
    }
    location {
      content
      translations {
        content
        language_code
      }
    }
    country {
      content
      translations {
        content
        language_code
      }
    }
    links
    objectsCount
    datasourcesCount
    assetsCount
  }
  count: institutionsCount(project_id: $projectId)
}`
    },

    // COUNT - Using the custom resolver
    count: {
        type: "query",
        name: "Count Institutions",
        description: "Returns the total count of institutions, optionally filtered by project",
        variables: {
            projectId: "Optional ID of project to filter by"
        },
        query: `query CountInstitutions($projectId: String) {
  result: institutionsCount(project_id: $projectId)
}`
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
                query: `mutation CreateInstitutionName($institutionName: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $institutionName
        context: "institutions.name"
        original_language: $languageCode
      }
    ]
  ) {
    id
    content
  }
}`,
                useVariables: ["institutionName", "languageCode"]
            },
            {
                name: "createDescriptionText",
                query: `mutation CreateInstitutionDescription($institutionDescription: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $institutionDescription
        context: "institutions.description"
        original_language: $languageCode
      }
    ]
  ) {
    id
    content
  }
}`,
                useVariables: ["institutionDescription", "languageCode"]
            },
            {
                name: "createCountryText",
                query: `mutation CreateInstitutionCountry($country: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $country
        context: "institutions.country"
        original_language: $languageCode
      }
    ]
  ) {
    id
    content
  }
}`,
                useVariables: ["country", "languageCode"]
            },
            {
                name: "createLocationText",
                query: `mutation CreateInstitutionLocation($location: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $location
        context: "institutions.location"
        original_language: $languageCode
      }
    ]
  ) {
    id
    content
  }
}`,
                useVariables: ["location", "languageCode"]
            },
            {
                name: "createInstitution",
                query: `mutation CreateInstitutionEntry(
  $nameId: String!
  $descriptionId: String!
  $countryId: String!
  $locationId: String!
  $projectId: String!
  $status: String
) {
  insertIntoInstitutions(
    values: [
      {
        name_id: $nameId
        description_id: $descriptionId
        country_id: $countryId
        location_id: $locationId
        project_id: $projectId
        status: $status
      }
    ]
  ) {
    id
    name_id
    description_id
    country_id
    location_id
    project_id
    status
  }
}`,
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
                query: `query GetInstitutionForUpdate($institutionId: String!) {
  institutions(where: { id: { eq: $institutionId } }) {
    id
    name_id
    description_id
    country_id
    location_id
    status
    links
  }
}`,
                useVariables: ["institutionId"]
            },
            {
                name: "updateName",
                query: `mutation UpdateInstitutionName($nameId: String!, $name: String!) {
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
                    nameId: { from: "getInstitution", path: "institutions.0.name_id" }
                },
                skipIf: { variableName: "name", isUndefined: true }
            },
            {
                name: "updateDescription",
                query: `mutation UpdateInstitutionDescription($descriptionId: String!, $description: String!) {
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
                    descriptionId: { from: "getInstitution", path: "institutions.0.description_id" }
                },
                skipIf: { variableName: "description", isUndefined: true }
            },
            {
                name: "updateCountry",
                query: `mutation UpdateInstitutionCountry($countryId: String!, $country: String!) {
  updateTexts(
    set: { content: $country }
    where: { id: { eq: $countryId } }
  ) {
    id
    content
  }
}`,
                useVariables: ["country"],
                mapVariables: {
                    countryId: { from: "getInstitution", path: "institutions.0.country_id" }
                },
                skipIf: { variableName: "country", isUndefined: true }
            },
            {
                name: "updateLocation",
                query: `mutation UpdateInstitutionLocation($locationId: String!, $location: String!) {
  updateTexts(
    set: { content: $location }
    where: { id: { eq: $locationId } }
  ) {
    id
    content
  }
}`,
                useVariables: ["location"],
                mapVariables: {
                    locationId: { from: "getInstitution", path: "institutions.0.location_id" }
                },
                skipIf: { variableName: "location", isUndefined: true }
            },
            {
                name: "updateStatus",
                query: `mutation UpdateInstitutionStatus($institutionId: String!, $status: String!) {
  updateInstitutions(
    set: { status: $status }
    where: { id: { eq: $institutionId } }
  ) {
    id
    status
  }
}`,
                useVariables: ["institutionId", "status"],
                skipIf: { variableName: "status", isUndefined: true }
            },
            {
                name: "updateLinks",
                query: `mutation UpdateInstitutionLinks($institutionId: String!, $links: String!) {
  updateInstitutions(
    set: { links: $links }
    where: { id: { eq: $institutionId } }
  ) {
    id
    links
  }
}`,
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
                query: `query GetInstitutionForDelete($institutionId: String!) {
  institutions(where: { id: { eq: $institutionId } }) {
    id
    name_id
    description_id
    country_id
    location_id
    status
    links
  }
}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteObjects",
                query: `mutation DeleteInstitutionObjects($institutionId: String!) {
  deleteFromObjects(where: { institution_id: { eq: $institutionId } }) {
    id
  }
}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteDatasources",
                query: `mutation DeleteInstitutionDatasources($institutionId: String!) {
  deleteFromDatasources(where: { institution_id: { eq: $institutionId } }) {
    id
  }
}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteAssetsRelations",
                query: `mutation DeleteInstitutionAssetsRelations($institutionId: String!) {
  deleteFromAssets_institutions(where: { institution_id: { eq: $institutionId } }) {
    id
  }
}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteInstitution",
                query: `mutation DeleteInstitutionFinal($institutionId: String!) {
  deleteFromInstitutions(where: { id: { eq: $institutionId } }) {
    id
    name_id
    description_id
    country_id
    location_id
  }
}`,
                useVariables: ["institutionId"]
            },
            {
                name: "deleteNameText",
                query: `mutation DeleteInstitutionNameText($nameId: String!) {
  deleteFromTexts(where: { id: { eq: $nameId } }) {
    id
  }
}`,
                mapVariables: {
                    nameId: { from: "getInstitution", path: "institutions.0.name_id" }
                },
                skipIf: { variableName: "nameId", isUndefined: true }
            },
            {
                name: "deleteDescriptionText",
                query: `mutation DeleteInstitutionDescriptionText($descriptionId: String!) {
  deleteFromTexts(where: { id: { eq: $descriptionId } }) {
    id
  }
}`,
                mapVariables: {
                    descriptionId: { from: "getInstitution", path: "institutions.0.description_id" }
                },
                skipIf: { variableName: "descriptionId", isUndefined: true }
            },
            {
                name: "deleteCountryText",
                query: `mutation DeleteInstitutionCountryText($countryId: String!) {
  deleteFromTexts(where: { id: { eq: $countryId } }) {
    id
  }
}`,
                mapVariables: {
                    countryId: { from: "getInstitution", path: "institutions.0.country_id" }
                },
                skipIf: { variableName: "countryId", isUndefined: true }
            },
            {
                name: "deleteLocationText",
                query: `mutation DeleteInstitutionLocationText($locationId: String!) {
  deleteFromTexts(where: { id: { eq: $locationId } }) {
    id
  }
}`,
                mapVariables: {
                    locationId: { from: "getInstitution", path: "institutions.0.location_id" }
                },
                skipIf: { variableName: "locationId", isUndefined: true }
            }
        ],
        query: null
    }
}; 