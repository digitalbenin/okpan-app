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
      search: "Optional search term to filter institutions by name, description, country, or location",
      languageCode: "Optional language code to filter search results",
      status: "Optional status to filter institutions by",
      page: "Page number for pagination (0-based)",
      pageSize: "Number of items per page",
      orderBy: "Field to order by (created_at, updated_at, name)",
      direction: "Sort direction (asc or desc)"
    },
    query: `query GetInstitutionsList(
  $projectId: String
  $search: String
  $languageCode: String
  $status: String
  $page: Int = 0
  $pageSize: Int = 10
  $orderBy: String = "created_at"
  $direction: String = "desc"
) {
  result: institutionsList(
    project_id: $projectId
    search: $search
    languageCode: $languageCode
    status: $status
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
    previewImages
  }
  count: institutionsCount(project_id: $projectId, search: $search, languageCode: $languageCode, status: $status)
}`
  },

  // COUNT - Using the custom resolver
  count: {
    type: "query",
    name: "Count Institutions",
    description: "Returns the total count of institutions, optionally filtered by project or search term",
    variables: {
      projectId: "Optional ID of project to filter by",
      search: "Optional search term to filter institutions",
      languageCode: "Optional language code to filter search results",
      status: "Optional status to filter institutions by"
    },
    query: `query CountInstitutions($projectId: String, $search: String, $languageCode: String, $status: String) {
  result: institutionsCount(project_id: $projectId, search: $search, languageCode: $languageCode, status: $status)
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
      links: "New links array (optional, should be JSON)"
    },
    mutations: [
      {
        name: "getInstitution",
        query: `query GetInstitutionForUpdate($institutionId: String!) {
  institution: institutionById(institution_id: $institutionId) {
    id
    name { id }
    description { id }
    country { id }
    location { id }
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
          nameId: { from: "getInstitution", path: "institution.name.id" }
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
          descriptionId: { from: "getInstitution", path: "institution.description.id" }
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
          countryId: { from: "getInstitution", path: "institution.country.id" }
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
          locationId: { from: "getInstitution", path: "institution.location.id" }
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
        query: `mutation UpdateInstitutionLinks($institutionId: String!, $links: JSON!) {
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
  },

  // ===== BULK OPERATIONS =====
  bulkUpdate: {
    type: "mutation",
    name: "Bulk Update Institutions",
    description: "Updates multiple institutions using a single optimized query",
    variables: {
      updates: "Array of institution updates with id and fields to update"
    },
    query: `mutation BulkUpdateInstitutions($updates: [JSON!]!) {
      bulkUpdateInstitutions(updates: $updates) {
        id
        name_id
        description_id
        country_id
        location_id
        status
        updated_at
      }
    }`
  },

  bulkDelete: {
    type: "mutation",
    name: "Bulk Delete Institutions",
    description: "Deletes multiple institutions by IDs",
    variables: {
      ids: "Array of institution IDs to delete"
    },
    query: `mutation BulkDeleteInstitutions($ids: [String!]!) {
      bulkDeleteInstitutions(ids: $ids) {
        id
        name_id
        project_id
      }
    }`
  }
}; 