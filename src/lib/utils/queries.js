export const API_SECTIONS = {
  languages: {
    name: "Languages",
    operations: [
      {
        type: "mutation",
        name: "Create Language",
        description: "Creates a new supported language",
        variables: {
          code: "Language code (e.g., 'en', 'es')",
          name: "Language name (e.g., 'English', 'Spanish')",
          isDefault: "Is this the default language (0 or 1)"
        },
        query: `mutation CreateLanguage($code: String!, $name: String!, $isDefault: Int!) {
  insertIntoLanguages(values: [{
    code: $code,
    name: $name,
    is_default: $isDefault
  }]) {
    id
    code
    name
    is_default
  }
}`
      },
      {
        type: "mutation",
        name: "Delete Language",
        description: "Deletes a language by its code",
        variables: {
          code: "Language code to delete"
        },
        query: `mutation DeleteLanguage($code: String!) {
  deleteFromLanguages(where: { code: { eq: $code } }) {
    code
    name
  }
}`
      },
      {
        type: "query",
        name: "List Languages",
        description: "Lists all supported languages",
        query: `{
  languages {
    id
    code
    name
    is_default
  }
}`
      }
    ]
  },
  projects: {
    name: "Projects",
    operations: [
      {
        type: "mutation",
        name: "Create Project",
        description: "Creates a new project with title and description",
        variables: {
          projectName: "Name of the project",
          description: "Description of the project",
          languageCode: "Language code for the initial text"
        },
        mutations: [
          {
            name: "createTitle",
            query: `mutation CreateProjectTitle($projectName: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $projectName,
    context: "project.title",
    original_language: $languageCode
  }]) {
    id
  }
}`,
            useVariables: ["projectName", "languageCode"]
          },
          {
            name: "createDescription",
            query: `mutation CreateProjectDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $description,
    context: "project.description",
    original_language: $languageCode
  }]) {
    id
  }
}`,
            useVariables: ["description", "languageCode"]
          },
          {
            name: "createProject",
            query: `mutation CreateProjectEntry($titleId: String!, $descriptionId: String!) {
  insertIntoProject(values: [{
    title_id: $titleId,
    description_id: $descriptionId
  }]) {
    id
    title_id
    description_id
  }
}`,
            mapVariables: {
              titleId: { from: "createTitle", path: "insertIntoTexts.0.id" },
              descriptionId: { from: "createDescription", path: "insertIntoTexts.0.id" }
            }
          }
        ],
        query: null
      },
      {
        type: "mutation",
        name: "Update Project",
        description: "Updates an existing project by ID",
        variables: {
          projectId: "ID of the project to update",
          title: "New title content",
          description: "New description content",
          languageCode: "Language code for the update"
        },
        query: `mutation UpdateProject($projectId: String!, $title: String!, $description: String!) {
  # Update the title translation
  updateTitle: updateTexts(
    set: { content: $title }
    where: { id: { eq: $projectId } }
  ) {
    id
    content
    original_language
  }
  # Update the description translation
  updateDescription: updateTexts(
    set: { content: $description }
    where: { id: { eq: $projectId } }
  ) {
    id
    content
    original_language
  }
}`
      },
      {
        type: "mutation",
        name: "Delete Project",
        description: "Deletes a project by ID",
        variables: {
          projectId: "ID of the project to delete"
        },
        query: `mutation DeleteProject($projectId: String!) {
  deleteFromProject(where: { id: { eq: $projectId } }) {
    id
    title_id
  }
}`
      },
      {
        type: "query",
        name: "List Projects",
        description: "Retrieves all projects with their institutions",
        query: `{
  project {
    id
    created_at
    updated_at
    title_id
    description_id
    title {
      content
      original_language
    }
    description {
      content
      original_language
    }
    institutionsCount
    institutions {
      id
      name_id
      description_id
      country_id
      location_id
      name {
        content
        original_language
      }
      description {
        content
        original_language
      }
      country {
        content
        original_language
      }
      location {
        content
        original_language
      }
    }
  }
}`
      }
    ]
  },
  institutions: {
    name: "Institutions",
    operations: [
      {
        type: "query",
        name: "Get Institution by ID",
        description: "Retrieves a single institution by its ID",
        variables: {
          projectId: "ID of the institution to retrieve"
        },
        query: `query GetInstitution($projectId: String!) {
  institutions(where: { id: { eq: $projectId } }) {
    id
    created_at
    updated_at
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
    project {
      id
      title {
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
    }
    country {
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
  }
}`
      },
      {
        type: "mutation",
        name: "Create Institution",
        description: "Creates a new institution linked to a project",
        variables: {
          projectId: "ID of the project to link the institution to",
          languageCode: "Language code for the initial text",
          institutionName: "Name of the institution",
          institutionDescription: "Description of the institution",
          country: "Country of the institution",
          location: "Location of the institution"
        },
        mutations: [
          {
            name: "createNameText",
            query: `mutation CreateInstitutionName($institutionName: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $institutionName,
    context: "institutions.name",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["institutionName", "languageCode"]
          },
          {
            name: "createDescriptionText",
            query: `mutation CreateInstitutionDescription($institutionDescription: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $institutionDescription,
    context: "institutions.description",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["institutionDescription", "languageCode"]
          },
          {
            name: "createCountryText",
            query: `mutation CreateInstitutionCountry($country: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $country,
    context: "institutions.country",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["country", "languageCode"]
          },
          {
            name: "createLocationText",
            query: `mutation CreateInstitutionLocation($location: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $location,
    context: "institutions.location",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["location", "languageCode"]
          },
          {
            name: "createInstitution",
            query: `mutation CreateInstitutionEntry($nameId: String!, $descriptionId: String!, $countryId: String!, $locationId: String!, $projectId: String!) {
  insertIntoInstitutions(values: [{
    name_id: $nameId,
    description_id: $descriptionId,
    country_id: $countryId,
    location_id: $locationId,
    project_id: $projectId
  }]) {
    id
    name_id
    description_id
    country_id
    location_id
    project_id
  }
}`,
            useVariables: ["projectId"],
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
      {
        type: "query",
        name: "List Institutions",
        description: "Retrieves all institutions",
        query: `{
  institutions {
    id
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
    project {
      id
      title {
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
    }
    country {
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
  }
}`
      }
    ]
  },
  translations: {
    name: "Translations",
    operations: [
      {
        type: "mutation",
        name: "Create Translation",
        description: "Creates a translation for a specific text",
        variables: {
          textId: "ID of the text to translate",
          languageCode: "Language code for the translation",
          content: "Translated content"
        },
        query: `mutation CreateTranslation($textId: String!, $languageCode: String!, $content: String!) {
  insertIntoTranslations(values: [{
    text_id: $textId,
    language_code: $languageCode,
    content: $content
  }]) {
    id
    content
    language_code
    text_id
  }
}`
      },
      {
        type: "mutation",
        name: "Update Translation",
        description: "Updates an existing translation",
        variables: {
          id: "ID of the translation to update",
          content: "New translated content"
        },
        query: `mutation UpdateTranslation($id: String!, $content: String!) {
  updateTranslations(
    set: { content: $content }
    where: { id: { eq: $id } }
  ) {
    id
    content
    language_code
    text_id
  }
}`
      }
    ]
  },
  schema: {
    name: "GraphQL Schema",
    operations: [
      {
        type: "schema",
        name: "Introspection Query",
        description: "Retrieves the GraphQL schema structure",
        query: `{
  __schema {
    types {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
    mutationType {
      fields {
        name
        args {
          name
          type {
            name
            kind
          }
        }
      }
    }
  }
}`
      }
    ]
  }
}; 