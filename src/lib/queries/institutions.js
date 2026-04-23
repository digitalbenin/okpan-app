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
    location {
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
    country {
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
    links
    website
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
        language_id
        language {
          id
          code
          name
        }
      }
    }
    description {
      content
      translations {
        content
        language_id
        language {
          id
          code
          name
        }
      }
    }
    location {
      content
      translations {
        content
        language_id
        language {
          id
          code
          name
        }
      }
    }
    country {
      content
      translations {
        content
        language_id
        language {
          id
          code
          name
        }
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
      project_id: "ID of the project to link the institution to",
      languageId: "Language ID for the initial text (from project's available languages)",
      name: "Name of the institution",
      description: "Description of the institution",
      country: "Country of the institution",
      location: "Location of the institution",
      website: "Website URL of the institution",
      links: "JSON array of additional links"
    },
    mutations: [
      {
        name: "createNameText",
        query: `mutation CreateInstitutionName($name: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $name
        context: "institutions.name"
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
        query: `mutation CreateInstitutionDescription($description: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "institutions.description"
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
      {
        name: "createCountryText",
        query: `mutation CreateInstitutionCountry($country: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $country
        context: "institutions.country"
        original_language_id: $languageId
      }
    ]
  ) {
    id
    content
  }
}`,
        useVariables: ["country", "languageId"]
      },
      {
        name: "createLocationText",
        query: `mutation CreateInstitutionLocation($location: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $location
        context: "institutions.location"
        original_language_id: $languageId
      }
    ]
  ) {
    id
    content
  }
}`,
        useVariables: ["location", "languageId"]
      },
      {
        name: "createInstitution",
        query: `mutation CreateInstitutionEntry(
  $nameId: String!
  $descriptionId: String!
  $countryId: String!
  $locationId: String!
  $project_id: String!
  $status: String
  $website: String
  $links: JSON
) {
  result:insertIntoInstitutions(
    values: [
      {
        name_id: $nameId
        description_id: $descriptionId
        country_id: $countryId
        location_id: $locationId
        project_id: $project_id
        status: $status
        website: $website
        links: $links
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
    website
    links
  }
}`,
        useVariables: ["project_id", "status", "website", "links"],
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
      id: "ID of the institution to update",
      name: "New name content (optional)",
      description: "New description content (optional)",
      country: "New country content (optional)",
      location: "New location content (optional)",
      status: "New status (optional)",
      website: "New website URL (optional)",
      links: "New links array (optional, should be JSON)",
      languageId: "Default language ID for creating new text entries (optional)",
      // Translation arrays
      nameTranslations: "Array of name translations (optional)",
      descriptionTranslations: "Array of description translations (optional)",
      countryTranslations: "Array of country translations (optional)",
      locationTranslations: "Array of location translations (optional)"
    },
    mutations: [
      {
        name: "getInstitution",
        query: `query GetInstitutionForUpdate($id: String!) {
  institution: institutionById(institution_id: $id) {
    id
    name { id }
    description { id }
    country { id }
    location { id }
    status
    website
    links
  }
}`,
        useVariables: ["id"]
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
        name: "createDescription",
        query: `mutation CreateInstitutionDescription($description: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "institutions.description"
        original_language_id: $languageId
      }
    ]
  ) {
    id
    content
  }
}`,
        useVariables: ["description", "languageId"],
        skipIf: { variableName: "description", isUndefined: true },
        onlyIf: { from: "getInstitution", path: "institution.description", isNull: true }
      },
      {
        name: "linkDescription",
        query: `mutation LinkInstitutionDescription($id: String!, $descriptionId: String!) {
  updateInstitutions(
    set: { description_id: $descriptionId }
    where: { id: { eq: $id } }
  ) {
    id
    description_id
  }
}`,
        useVariables: ["id"],
        mapVariables: {
          descriptionId: { from: "createDescription", path: "insertIntoTexts.0.id" }
        },
        skipIf: { variableName: "descriptionId", isUndefined: true }
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
        onlyIf: { from: "getInstitution", path: "institution.description", isNull: false },
        skipIf: { variableName: "description", isUndefined: true }
      },
      {
        name: "createCountry",
        query: `mutation CreateInstitutionCountry($country: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $country
        context: "institutions.country"
        original_language_id: $languageId
      }
    ]
  ) {
    id
    content
  }
}`,
        useVariables: ["country", "languageId"],
        skipIf: { variableName: "country", isUndefined: true },
        onlyIf: { from: "getInstitution", path: "institution.country", isNull: true }
      },
      {
        name: "linkCountry",
        query: `mutation LinkInstitutionCountry($id: String!, $countryId: String!) {
  updateInstitutions(
    set: { country_id: $countryId }
    where: { id: { eq: $id } }
  ) {
    id
    country_id
  }
}`,
        useVariables: ["id"],
        mapVariables: {
          countryId: { from: "createCountry", path: "insertIntoTexts.0.id" }
        },
        skipIf: { variableName: "countryId", isUndefined: true }
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
        name: "createLocation",
        query: `mutation CreateInstitutionLocation($location: String!, $languageId: String!) {
  insertIntoTexts(
    values: [
      {
        content: $location
        context: "institutions.location"
        original_language_id: $languageId
      }
    ]
  ) {
    id
    content
  }
}`,
        useVariables: ["location", "languageId"],
        skipIf: { variableName: "location", isUndefined: true },
        onlyIf: { from: "getInstitution", path: "institution.location", isNull: true }
      },
      {
        name: "linkLocation",
        query: `mutation LinkInstitutionLocation($id: String!, $locationId: String!) {
  updateInstitutions(
    set: { location_id: $locationId }
    where: { id: { eq: $id } }
  ) {
    id
    location_id
  }
}`,
        useVariables: ["id"],
        mapVariables: {
          locationId: { from: "createLocation", path: "insertIntoTexts.0.id" }
        },
        skipIf: { variableName: "locationId", isUndefined: true }
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
        query: `mutation UpdateInstitutionStatus($id: String!, $status: String!) {
  updateInstitutions(
    set: { status: $status }
    where: { id: { eq: $id } }
  ) {
    id
    status
  }
}`,
        useVariables: ["id", "status"],
        skipIf: { variableName: "status", isEmpty: true }
      },
      {
        name: "updateLinks",
        query: `mutation UpdateInstitutionLinks($id: String!, $links: JSON!) {
  updateInstitutions(
    set: { links: $links }
    where: { id: { eq: $id } }
  ) {
    id
    links
  }
}`,
        useVariables: ["id", "links"],
        skipIf: { variableName: "links", isEmpty: true }
      },
      {
        name: "updateWebsite",
        query: `mutation UpdateInstitutionWebsite($id: String!, $website: String!) {
  updateInstitutions(
    set: { website: $website }
    where: { id: { eq: $id } }
  ) {
    id
    website
  }
}`,
        useVariables: ["id", "website"],
        skipIf: { variableName: "website", isEmpty: true }
      },
      // === TRANSLATION PROCESSING STEPS ===
      {
        name: "processNameTranslations",
        processTranslations: {
          textIdPath: "getInstitution.institution.name.id",
          translationsParam: "nameTranslations"
        }
      },
      {
        name: "processDescriptionTranslations",
        processTranslations: {
          textIdPath: "getInstitution.institution.description.id",
          translationsParam: "descriptionTranslations"
        }
      },
      {
        name: "processCountryTranslations",
        processTranslations: {
          textIdPath: "getInstitution.institution.country.id",
          translationsParam: "countryTranslations"
        }
      },
      {
        name: "processLocationTranslations",
        processTranslations: {
          textIdPath: "getInstitution.institution.location.id",
          translationsParam: "locationTranslations"
        }
      }
    ],
    query: null
  },

  updateStatus: {
    type: "mutation",
    name: "Update Institution Status",
    description: "Updates the status of an institution by ID",
    variables: {
      id: "ID of the institution to update",
      status: "New status"
    },
    query: `mutation UpdateInstitutionStatus($id: String!, $status: String!) {
  result: updateInstitutions(
    set: { status: $status }
    where: { id: { eq: $id } }
  ) {
    id
    status
  }
}`
  },

  // DELETE
  delete: {
    type: "mutation",
    name: "Delete Institution",
    description: "Deletes an institution by ID",
    variables: {
      id: "ID of the institution to delete"
    },
    mutations: [
      {
        name: "getInstitution",
        query: `query GetInstitutionForDelete($id: String!) {
  institutions(where: { id: { eq: $id } }) {
    id
    name_id
    description_id
    country_id
    location_id
    status
    links
  }
}`,
        useVariables: ["id"]
      },
      {
        name: "deleteInstitution",
        query: `mutation DeleteInstitutionFinal($id: String!) {
  deleteFromInstitutions(where: { id: { eq: $id } }) {
    id
    name_id
    description_id
    country_id
    location_id
  }
}`,
        useVariables: ["id"]
      },
      {
        name: "deleteNameTranslations",
        query: `mutation DeleteInstitutionNameTranslations($nameId: String!) {
  deleteFromTranslations(where: { text_id: { eq: $nameId } }) {
    id
  }
}`,
        mapVariables: {
          nameId: { from: "getInstitution", path: "institutions.0.name_id" }
        },
        skipIf: { variableName: "nameId", isUndefined: true }
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
        name: "deleteDescriptionTranslations",
        query: `mutation DeleteInstitutionDescriptionTranslations($descriptionId: String!) {
  deleteFromTranslations(where: { text_id: { eq: $descriptionId } }) {
    id
  }
}`,
        mapVariables: {
          descriptionId: { from: "getInstitution", path: "institutions.0.description_id" }
        },
        skipIf: { variableName: "descriptionId", isUndefined: true }
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
        name: "deleteCountryTranslations",
        query: `mutation DeleteInstitutionCountryTranslations($countryId: String!) {
  deleteFromTranslations(where: { text_id: { eq: $countryId } }) {
    id
  }
}`,
        mapVariables: {
          countryId: { from: "getInstitution", path: "institutions.0.country_id" }
        },
        skipIf: { variableName: "countryId", isUndefined: true }
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
        name: "deleteLocationTranslations",
        query: `mutation DeleteInstitutionLocationTranslations($locationId: String!) {
  deleteFromTranslations(where: { text_id: { eq: $locationId } }) {
    id
  }
}`,
        mapVariables: {
          locationId: { from: "getInstitution", path: "institutions.0.location_id" }
        },
        skipIf: { variableName: "locationId", isUndefined: true }
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