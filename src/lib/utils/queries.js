import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { addToast } from "$lib/components/base/BaseToast.svelte";
const { error: logError } = getLogStore();

export const performQuery = async (query, params) => {
  let result = null;
  try {
    const response = await window.api.executeGraphQL(query.query, params);
    result = response.data;
  } catch (error) {
    addToast({
      data: {
        title: "Error",
        description: `Failed to fetch query ${query.name}: ${error.message}`,
        type: "error"
      }
    });
    await logError(query.name, error.message);
    throw error;
  } finally {
    //console.log(`result from query ${query.name}:`, result);
    return result;
  }
}

export const API_SECTIONS = {
  interface_languages: {
    name: "Interface Languages",
    operations: {
      interfaceLanguagesList: {
        type: "query",
        name: "List Interface Languages",
        description: "Lists all supported interface languages",
        query: `{
  result: interface_languages {
    id
    code
    name
  }
}`
      },
      interfaceLanguagesCreate: {
        type: "mutation",
        name: "Create Interface Language",
        description: "Creates a new interface language",
        variables: {
          code: "Language code (e.g., 'en', 'es')",
          name: "Language name (e.g., 'English', 'Spanish')"
        },
        query: `mutation CreateInterfaceLanguage($code: String!, $name: String!) {
  insertIntoInterface_languages(values: [{
    code: $code,
    name: $name
  }]) {
    id
    code
    name
  }
}`
      },
      interfaceLanguagesDelete: {
        type: "mutation",
        name: "Delete Interface Language",
        description: "Deletes an interface language by its code",
        variables: {
          code: "Language code to delete"
        },
        query: `mutation DeleteInterfaceLanguage($code: String!) {
  deleteFromInterface_languages(where: { code: { eq: $code } }) {
    code
    name
  }
}`
      }
    }
  },
  languages: {
    name: "Content Languages",
    operations: {
      contentLanguagesCreate: {
        type: "mutation",
        name: "Create Content Language",
        description: "Creates a new content language for translations",
        variables: {
          code: "Language code (e.g., 'en', 'es')",
          name: "Language name (e.g., 'English', 'Spanish')"
        },
        query: `mutation CreateContentLanguage($code: String!, $name: String!) {
  insertIntoLanguages(values: [{
    code: $code,
    name: $name
  }]) {
    id
    code
    name
  }
}`
      },
      contentLanguagesDelete: {
        type: "mutation",
        name: "Delete Content Language",
        description: "Deletes a content language by its code",
        variables: {
          code: "Language code to delete"
        },
        query: `mutation DeleteContentLanguage($code: String!) {
  deleteFromLanguages(where: { code: { eq: $code } }) {
    code
    name
  }
}`
      },
      contentLanguagesList: {
        type: "query",
        name: "List Content Languages",
        description: "Lists all supported content languages",
        query: `{
  result: languages {
    id
    code
    name
  }
}`
      },
      contentLanguagesListByProject: {
        type: "query",
        name: "List Content Languages by Project",
        description: "Lists all languages associated with a specific project",
        variables: {
          projectId: "ID of the project"
        },
        query: `query GetProjectLanguages($projectId: String!) {
  result: project_languages(where: { project_id: { eq: $projectId } }) {
    language_code
    is_default
    language {
      code
      name
    }
  }
}`
      }
    }
  },
  projects: {
    name: "Projects",
    operations: {
      projectsCreate: {
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
          },
          {
            name: "addDefaultLanguage",
            query: `mutation AddDefaultLanguage($projectId: String!, $languageCode: String!) {
  insertIntoProject_languages(values: [{
    project_id: $projectId,
    language_code: $languageCode,
    is_default: 1
  }]) {
    project_id
    language_code
    is_default
  }
}`,
            useVariables: ["languageCode"],
            mapVariables: {
              projectId: { from: "createProject", path: "insertIntoProject.0.id" }
            }
          }
        ],
        query: null
      },
      projectsUpdate: {
        type: "mutation",
        name: "Update Project",
        description: "Updates an existing project by ID",
        variables: {
          projectId: "ID of the project to update",
          title: "New title content (optional)",
          description: "New description content (optional)"
        },
        query: `mutation UpdateProject($projectId: String!, $title: String, $description: String) {
  # Update the title translation if provided
  updateTitle: updateTexts(
    set: { content: $title }
    where: { id: { eq: $projectId } }
  ) {
    id
    content
    original_language
  }
  # Update the description translation if provided
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
      projectsDelete: {
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
      projectsGetById: {
        type: "query",
        name: "Get Project by ID",
        description: "Retrieves a single project by its ID",
        variables: {
          projectId: "ID of the project to retrieve"
        },
        query: `query GetProject($projectId: String!) {
  result: project(where: { id: { eq: $projectId } }) {
    id
    created_at
    updated_at
    title_id
    description_id
    title {
      content
      original_language
      translations {
        content
        language_code
      }
    }
    description {
      content
      original_language
      translations {
        content
        language_code
      }
    }
    institutionsCount
    institutions {
      id
      name {
        content
      }
    }
    projectLanguages {
      language_code
      is_default
      language {
        code
        name
      }
    }
  }
}`
      },
      projectsList: {
        type: "query",
        name: "List Projects",
        description: "Retrieves all projects with their institutions and languages",
        query: `{
  result: project {
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
      name {
        content
      }
    }
    projectLanguages {
      language_code
      is_default
      language {
        code
        name
      }
    }
  }
}`
      },
      projectAddLanguage: {
        type: "mutation",
        name: "Add Language to Project",
        description: "Adds a language to a project",
        variables: {
          projectId: "ID of the project",
          languageCode: "Code of the language to add",
          isDefault: "Whether this is the default language (0 or 1)"
        },
        query: `mutation AddProjectLanguage($projectId: String!, $languageCode: String!, $isDefault: Int!) {
  insertIntoProject_languages(values: [{
    project_id: $projectId,
    language_code: $languageCode,
    is_default: $isDefault
  }]) {
    project_id
    language_code
    is_default
  }
}`
      },
      projectRemoveLanguage: {
        type: "mutation",
        name: "Remove Language from Project",
        description: "Removes a language from a project",
        variables: {
          projectId: "ID of the project",
          languageCode: "Code of the language to remove"
        },
        query: `mutation RemoveProjectLanguage($projectId: String!, $languageCode: String!) {
  deleteFromProject_languages(
    where: { 
      project_id: { eq: $projectId },
      language_code: { eq: $languageCode }
    }
  ) {
    project_id
    language_code
  }
}`
      },
      projectSetDefaultLanguage: {
        type: "mutation",
        name: "Set Project Default Language",
        description: "Sets the default language for a project",
        variables: {
          projectId: "ID of the project",
          languageCode: "Code of the language to set as default"
        },
        query: `mutation SetProjectDefaultLanguage($projectId: String!, $languageCode: String!) {
  # First, set all languages for this project to non-default
  updateAllToNonDefault: updateProject_languages(
    set: { is_default: 0 }
    where: { project_id: { eq: $projectId } }
  ) {
    project_id
  }
  # Then, set the specified language as default
  setNewDefault: updateProject_languages(
    set: { is_default: 1 }
    where: { 
      project_id: { eq: $projectId },
      language_code: { eq: $languageCode }
    }
  ) {
    project_id
    language_code
    is_default
  }
}`
      },
      projectsListWithCounts: {
        type: "query",
        name: "List projects (with counts)",
        description: "Retrieves all the projects with their institutions and objects count",
        query: `{
  result: projectsList {
    id
    created_at
    updated_at
    title {
      content
      original_language
      translations {
        content
        language_code      
      }
    }
    description {
      content
      original_language
      translations {
        content
        language_code
      }
    }
    institutionsCount
    objectsCount
  }
}`
      },
      projectByIdWithCounts: {
        type: "query",
        name: "Get project by ID (with counts)",
        description: "Retrieves a single project by its ID with all counts",
        variables: {
          projectId: "ID of the project to retrieve"
        },
        query: `query GetProjectById($projectId: String!) {
  result:projectById(project_id: $projectId) {
    id
    created_at
    updated_at
    title {
      content
      original_language
      translations {
        content
        language_code      
      }
    }
    description {
      content
      original_language
      translations {
        content
        language_code
      }
    }
    institutionsCount
    objectsCount
    assetsCount
  }
}`
      }
    }
  },
  institutions: {
    name: "Institutions",
    operations: {
      institutionsGetById: {
        type: "query",
        name: "Get Institution by ID",
        description: "Retrieves a single institution by its ID",
        variables: {
          projectId: "ID of the institution to retrieve"
        },
        query: `query GetInstitution($projectId: String!) {
  result:institutions(where: { id: { eq: $projectId } }) {
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
      institutionsCreate: {
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
      institutionsUpdate: {
        type: "mutation",
        name: "Update Institution",
        description: "Updates an existing institution by ID",
        variables: {
          institutionId: "ID of the institution to update",
          name: "New name content (optional)",
          description: "New description content (optional)",
          country: "New country content (optional)",
          location: "New location content (optional)"
        },
        query: `mutation UpdateInstitution(
  $institutionId: String!, 
  $name: String, 
  $description: String, 
  $country: String, 
  $location: String
) {
  # Update the name
  updateName: updateTexts(
    set: { content: $name }
    where: { id: { eq: $institutionId } }
  ) {
    id
    content
    original_language
  }
  # Update the description
  updateDescription: updateTexts(
    set: { content: $description }
    where: { id: { eq: $institutionId } }
  ) {
    id
    content
    original_language
  }
  # Update the country
  updateCountry: updateTexts(
    set: { content: $country }
    where: { id: { eq: $institutionId } }
  ) {
    id
    content
    original_language
  }
  # Update the location
  updateLocation: updateTexts(
    set: { content: $location }
    where: { id: { eq: $institutionId } }
  ) {
    id
    content
    original_language
  }
}`
      },
      institutionsDelete: {
        type: "mutation",
        name: "Delete Institution",
        description: "Deletes an institution by ID",
        variables: {
          institutionId: "ID of the institution to delete"
        },
        query: `mutation DeleteInstitution($institutionId: String!) {
  deleteFromInstitutions(where: { id: { eq: $institutionId } }) {
    id
    name_id
    description_id
    country_id
    location_id
  }
}`
      },
      institutionsList: {
        type: "query",
        name: "List Institutions",
        description: "Retrieves all institutions",
        query: `{
  result: institutions {
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
      },
      institutionsListWithCounts: {
        type: "query",
        name: "List Institutions (with counts)",
        description: "Retrieves all institutions with their counts",
        variables: {
          projectId: "Optional ID of project to filter by",
          page: "Page number for pagination (0-based)",
          pageSize: "Number of items per page",
          orderBy: "Field to order by (created_at, updated_at, name)",
          direction: "Sort direction (asc or desc)"
        },
        query: `query GetInstitutionsList($projectId: String, $page: Int = 0, $pageSize: Int = 10, $orderBy: String = "created_at", $direction: String = "desc") {
          result: institutionsList(project_id: $projectId, page: $page, pageSize: $pageSize, orderBy: $orderBy, direction: $direction) {
            id
            created_at
            updated_at
            project_id
            name {
              content
            }
            description {
              content
            }
            location {
              content
            }
            country {
              content
            }
            assetsCount
            datasourcesCount
            objectsCount
          }
          count: institutionsCount(project_id: $projectId)
        }`
      },
      institutionsGetByIdWithCounts: {
        type: "query",
        name: "Get Institution By ID (with counts)",
        description: "Retrieves a single institution by its ID with all details including counts",
        query: `query GetInstitution($institutionId: String!) {
          result: institutionById(institution_id: $institutionId) {
            id
            created_at
            updated_at
            project_id
            name {
              content
              original_language
              translations {
                language_code
                content
              }
            }
            description {
              content
              translations {
                language_code
                content
              }
            }
            location {
              content
              translations {
                language_code
                content
              }
            }
            country {
              content
              translations {
                language_code
                content
              }
            }
            links {
              content
              translations {
                language_code
                content
              }
            }
            assetsCount
            datasourcesCount
            objectsCount
          }
        }`,
        variables: {
          institutionId: "your-institution-id-here"
        }
      }
    }
  },
  objects: {
    name: "Objects",
    operations: {
      objectsList: {
        type: "query",
        name: "List Objects",
        description: "Retrieves all objects with optional filtering by project or institution",
        variables: {
          projectId: "Optional ID of project to filter by",
          institutionId: "Optional ID of institution to filter by"
        },
        query: `query ListObjects($projectId: String, $institutionId: String) {
  result: objects(
    where: {
      project_id: { eq: $projectId }
      institution_id: { eq: $institutionId }
    }
  ) {
    id
    status
    created_at
    updated_at
    institution_id
    project_id
    institution {
      id
      name {
        content
      }
    }
    project {
      id
      title {
        content
      }
    }
    objectsAssets {
      order
      asset {
        id
        filename
        path
        type     
      }
    }
  }
}`
      },
      objectsGetById: {
        type: "query",
        name: "Get Object by ID",
        description: "Retrieves a single object by its ID",
        variables: {
          objectId: "ID of the object to retrieve"
        },
        query: `query GetObject($objectId: String!) {
  result: objects(where: { id: { eq: $objectId } }) {
    id
    status
    created_at
    updated_at
    institution_id
    project_id
    institution {
      id
      name {
        content
      }
    }
    project {
      id
      title {
        content
      }
    }
    objectsResearchFields {
      id
      value
      vocabulary_id
      researchField {
        id
        name {
          content
        }
        type
      }
      vocabulary {
        id
        option {
          content
          original_language
          translations {
            language_code
            content
          }
        }
        description {
          content
          original_language
          translations {
            language_code
            content
          }
        }
      }
    }
    objectsOntologyFields {
      id
      label
      value
      field_id
      primary
      ontologyField {
        id
        name {
          content
        }
        category {
          content
        }
      }
    }
    objectsAssets {
      id
      order
      asset {
        id
        filename
        path
        type
      }
    }
  }
}`
      },
      objectsCreate: {
        type: "mutation",
        name: "Create Object",
        description: "Creates a new object",
        variables: {
          status: "Status of the object",
          institutionId: "ID of the institution this object belongs to",
          projectId: "ID of the project this object belongs to"
        },
        query: `mutation CreateObject($status: String, $institutionId: String!, $projectId: String!) {
  insertIntoObjects(values: [{
    status: $status,
    institution_id: $institutionId,
    project_id: $projectId
  }]) {
    id
    status
    created_at
    updated_at
    institution_id
    project_id
  }
}`
      },
      objectsUpdate: {
        type: "mutation",
        name: "Update Object",
        description: "Updates an existing object by ID",
        variables: {
          objectId: "ID of the object to update",
          status: "New status of the object (optional)",
          institutionId: "New institution ID for the object (optional)",
          projectId: "New project ID for the object (optional)"
        },
        query: `mutation UpdateObject(
  $objectId: String!,
  $status: String,
  $institutionId: String,
  $projectId: String
) {
  updateObjects(
    set: {
      status: $status,
      institution_id: $institutionId,
      project_id: $projectId
    }
    where: { id: { eq: $objectId } }
  ) {
    id
    status
    updated_at
    institution_id
    project_id
  }
}`
      },
      objectsDelete: {
        type: "mutation",
        name: "Delete Object",
        description: "Deletes an object by ID",
        variables: {
          objectId: "ID of the object to delete"
        },
        query: `mutation DeleteObject($objectId: String!) {
  deleteFromObjects(where: { id: { eq: $objectId } }) {
    id
    status
    institution_id
    project_id
  }
}`
      },
      objectsAddAsset: {
        type: "mutation",
        name: "Add Asset to Object",
        description: "Associates an asset with an object",
        variables: {
          objectId: "ID of the object",
          assetId: "ID of the asset to associate",
          order: "Display order for the asset (optional)"
        },
        query: `mutation AddAssetToObject($objectId: String!, $assetId: String!, $order: Int) {
  insertIntoObjects_assets(values: [{
    object_id: $objectId,
    asset_id: $assetId,
    order: $order
  }]) {
    id
    object_id
    asset_id
    order
  }
}`
      },
      objectsRemoveAsset: {
        type: "mutation",
        name: "Remove Asset from Object",
        description: "Removes the association between an asset and an object",
        variables: {
          objectId: "ID of the object",
          assetId: "ID of the asset to remove"
        },
        query: `mutation RemoveAssetFromObject($objectId: String!, $assetId: String!) {
  deleteFromObjects_assets(
    where: { 
      object_id: { eq: $objectId },
      asset_id: { eq: $assetId }
    }
  ) {
    id
    object_id
    asset_id
  }
}`
      },
      objectsUpdateAssetOrder: {
        type: "mutation",
        name: "Update Asset Order",
        description: "Updates the display order of an asset associated with an object",
        variables: {
          objectId: "ID of the object",
          assetId: "ID of the asset",
          order: "New display order for the asset"
        },
        query: `mutation UpdateAssetOrder($objectId: String!, $assetId: String!, $order: Int!) {
  updateObjects_assets(
    set: { order: $order }
    where: { 
      object_id: { eq: $objectId },
      asset_id: { eq: $assetId }
    }
  ) {
    id
    object_id
    asset_id
    order
  }
}`
      },
      objectsGetAssets: {
        type: "query",
        name: "Get Object Assets",
        description: "Retrieves all assets associated with a specific object",
        variables: {
          objectId: "ID of the object"
        },
        query: `query GetObjectAssets($objectId: String!) {
  objects_assets(
    where: { object_id: { eq: $objectId } }
    orderBy: { order: ASC }
  ) {
    id
    order
    asset {
      id
      filename
      path
      type
      formats
      properties
      created_at
      updated_at
    }
  }
}`
      },
      objectAssignResearchField: {
        type: "mutation",
        name: "Assign Research Field to Object",
        description: "Associates an object with a research field and assigns a value or vocabulary",
        variables: {
          objectId: "ID of the object",
          fieldId: "ID of the research field to assign",
          value: "Value to store for this field (for free text)",
          vocabularyId: "ID of the vocabulary option (for vocabulary-based fields)"
        },
        query: `mutation AssignResearchField($objectId: String!, $fieldId: String!, $value: String, $vocabularyId: String) {
  insertIntoObjects_research_fields(values: [{
    object_id: $objectId,
    field_id: $fieldId,
    value: $value,
    vocabulary_id: $vocabularyId
  }]) {
    id
    object_id
    field_id
    value
    vocabulary_id
  }
}`
      },
      objectUpdateResearchField: {
        type: "mutation",
        name: "Update Research Field Value for Object",
        description: "Updates the value or vocabulary of a research field associated with an object",
        variables: {
          objectId: "ID of the object",
          fieldId: "ID of the research field",
          value: "New value to store for this field (for free text, optional)",
          vocabularyId: "ID of the vocabulary option (for vocabulary-based fields, optional)"
        },
        query: `mutation UpdateResearchFieldValue($objectId: String!, $fieldId: String!, $value: String, $vocabularyId: String) {
  updateObjects_research_fields(
    set: { 
      value: $value,
      vocabulary_id: $vocabularyId
    }
    where: { 
      object_id: { eq: $objectId },
      field_id: { eq: $fieldId }
    }
  ) {
    id
    object_id
    field_id
    value
    vocabulary_id
  }
}`
      },
      objectGetResearchFields: {
        type: "query",
        name: "Get Object Research Fields",
        description: "Retrieves all research fields associated with a specific object",
        variables: {
          objectId: "ID of the object"
        },
        query: `query GetObjectResearchFields($objectId: String!) {
  objects_research_fields(where: { object_id: { eq: $objectId } }) {
    id
    value
    vocabulary_id
    field_id
    researchField {
      id
      type
      name {
        content
        translations {
          language_code
          content
        }
      }
      description {
        content
      }
      vocabularies {
        id
        option {
          content
          original_language
          translations {
            language_code
            content
          }
        }
        description {
          content
          original_language
          translations {
            language_code
            content
          }
        }
      }
    }
    vocabulary {
      id
      option {
        content
      }
      description {
        content
      }
    }
  }
}`
      }
    }
  },
  translations: {
    name: "Translations",
    operations: {
      translationsCreate: {
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
      translationsUpdate: {
        type: "mutation",
        name: "Update Translation",
        description: "Updates an existing translation",
        variables: {
          id: "ID of the translation to update",
          content: "New translated content"
        },
        query: `mutation UpdateTranslation($id: String!, $content: String) {
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
      },/*
      researchFieldsDeleteVocabulary: {
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
      }*/
    }
  },
  interface_translations: {
    name: "Interface Translations",
    operations: {
      interfaceTranslationsList: {
        type: "query",
        name: "List Interface Translations",
        description: "Retrieves all interface translations",
        query: `{
  result: interface_translations {
    id
    locale
    namespace
    key
    value
  }
}`
      },
      interfaceTranslationsGetByLocale: {
        type: "query",
        name: "Get Interface Translations By Locale",
        description: "Retrieves interface translations for a specific locale",
        variables: {
          locale: "Language code for the translations"
        },
        query: `query GetInterfaceTranslations($locale: String!) {
  result:interface_translations(where: { locale: { eq: $locale } }) {
    id
    namespace
    key
    value
  }
}`
      },
      interfaceTranslationsCreate: {
        type: "mutation",
        name: "Create Interface Translation",
        description: "Creates a new interface translation",
        variables: {
          locale: "Language code for the translation",
          namespace: "Namespace for grouping translations",
          key: "Translation key",
          value: "Translated content"
        },
        query: `mutation CreateInterfaceTranslation($locale: String!, $namespace: String!, $key: String!, $value: String!) {
  insertIntoInterface_translations(values: [{
    locale: $locale,
    namespace: $namespace,
    key: $key,
    value: $value
  }]) {
    id
    locale
    namespace
    key
    value
  }
}`
      },
      interfaceTranslationsUpdate: {
        type: "mutation",
        name: "Update Interface Translation",
        description: "Updates an existing interface translation",
        variables: {
          id: "ID of the translation to update",
          value: "New translated content (optional)"
        },
        query: `mutation UpdateInterfaceTranslation($id: String!, $value: String) {
  updateInterface_translations(
    set: { value: $value }
    where: { id: { eq: $id } }
  ) {
    id
    value
  }
}`
      },
      interfaceTranslationsDelete: {
        type: "mutation",
        name: "Delete Interface Translation",
        description: "Deletes an interface translation",
        variables: {
          id: "ID of the translation to delete"
        },
        query: `mutation DeleteInterfaceTranslation($id: String!) {
  deleteFromInterface_translations(where: { id: { eq: $id } }) {
    id
  }
}`
      },
      interfaceTranslationsImport: {
        type: "mutation",
        name: "Import Interface Translations",
        description: "Imports multiple interface translations at once",
        variables: {
          translations: "Array of translations to import"
        },
        query: `mutation ImportInterfaceTranslations($translations: [interface_translationsInsertInput!]!) {
  insertIntoInterface_translations(values: $translations) {
    id
    locale
    namespace
    key
    value
  }
}`
      }
    }
  },

  logs: {
    name: "Logs",
    operations: {
      logsList: {
        type: "query",
        name: "List Logs",
        description: "Retrieves logs with pagination and filtering",
        variables: {
          page: "Page number for pagination (offset)",
          pageSize: "Number of logs per page (limit)",
          level: "Filter by log level (error, warn, info, debug)",
          action: "Filter by action",
          fromDate: "Filter by date range (start timestamp)",
          toDate: "Filter by date range (end timestamp)",
          search: "Search in log messages"
        },
        query: `query ListLogs($page: Int!, $pageSize: Int!, $level: String, $action: String, $fromDate: String, $toDate: String, $search: String) {
  result: logs(
    limit: $pageSize
    offset: $page
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
      message: { like: $search }
    }
  ) {
    id
    created_at
    level
    action
    message
  }
  
  # Get total count for pagination
  count: logs(
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
      message: { like: $search }
    }
  ) {
    id
  }
}`
      },
      logsCreate: {
        type: "mutation",
        name: "Create Log",
        description: "Creates a new log entry",
        variables: {
          level: "Log level (error, warn, info, debug)",
          action: "The action that triggered the log",
          message: "Log message content"
        },
        query: `mutation CreateLog($level: String!, $action: String!, $message: String!) {
  insertIntoLogs(values: [{
    level: $level,
    action: $action,
    message: $message
  }]) {
    id
    created_at
    level
    action
    message
  }
}`
      },
      logsDelete: {
        type: "mutation",
        name: "Delete Log",
        description: "Deletes a log entry by ID",
        variables: {
          id: "ID of the log to delete"
        },
        query: `mutation DeleteLog($id: String!) {
  deleteFromLogs(where: { id: { eq: $id } }) {
    id
  }
}`
      },
      logsClear: {
        type: "mutation",
        name: "Clear Logs",
        description: "Clears logs based on filters",
        variables: {
          level: "Filter by log level",
          action: "Filter by action",
          fromDate: "Filter by date range (start timestamp)",
          toDate: "Filter by date range (end timestamp)"
        },
        query: `mutation ClearLogs($level: String, $action: String, $fromDate: String, $toDate: String) {
  deleteFromLogs(
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
    }
  ) {
    id
  }
}`
      }
    }
  },
  assets: {
    name: "Assets",
    operations: {
      assetsList: {
        type: "query",
        name: "List Assets",
        description: "Retrieves all assets with optional filtering and pagination",
        variables: {
          page: "Page number for pagination (offset)",
          pageSize: "Number of assets per page (limit)",
          projectId: "Filter by project ID",
          institutionId: "Filter by institution ID",
          type: "Filter by asset type"
        },
        query: `query ListAssets($page: Int, $pageSize: Int, $projectId: String, $institutionId: String, $type: String) {
  result: assets(
    limit: $pageSize
    offset: $page
    where: {
      project_id: { eq: $projectId }
      institution_id: { eq: $institutionId }
      type: { eq: $type }
    }
  ) {
    id
    filename
    path
    type
    formats
    properties
    institution_id
    project_id
    created_at
    updated_at
    institution {
      id
      name {
        content
      }
    }
    project {
      id
      title {
        content
      }
    }
  }
}`
      },
      assetsGetById: {
        type: "query",
        name: "Get Asset by ID",
        description: "Retrieves a single asset by its ID",
        variables: {
          assetId: "ID of the asset to retrieve"
        },
        query: `query GetAsset($assetId: String!) {
  result: assets(where: { id: { eq: $assetId } }) {
    id
    filename
    path
    type
    formats
    properties
    institution_id
    project_id
    created_at
    updated_at
    institution {
      id
      name {
        content
      }
    }
    project {
      id
      title {
        content
      }
    }
  }
}`
      },
      assetsUpdate: {
        type: "mutation",
        name: "Update Asset",
        description: "Updates an existing asset by ID",
        variables: {
          assetId: "ID of the asset to update",
          filename: "New filename (optional)",
          path: "New file path (optional)",
          type: "New asset type (optional)",
          formats: "New formats object (optional)",
          properties: "New properties object (optional)",
          institutionId: "New institution ID (optional)",
          projectId: "New project ID (optional)"
        },
        query: `mutation UpdateAsset(
  $assetId: String!,
  $filename: String,
  $path: String,
  $type: String,
  $formats: JSON,
  $properties: JSON,
  $institutionId: String,
  $projectId: String
) {
  updateAssets(
    set: {
      filename: $filename,
      path: $path,
      type: $type,
      formats: $formats,
      properties: $properties,
      institution_id: $institutionId,
      project_id: $projectId
    }
    where: { id: { eq: $assetId } }
  ) {
    id
    filename
    path
    type
    formats
    properties
    institution_id
    project_id
    updated_at
  }
}`
      },
      assetsDelete: {
        type: "mutation",
        name: "Delete Asset",
        description: "Deletes an asset by ID",
        variables: {
          assetId: "ID of the asset to delete"
        },
        query: `mutation DeleteAsset($assetId: String!) {
  deleteFromAssets(where: { id: { eq: $assetId } }) {
    id
    filename
    path
  }
}`
      }
    }
  },
  research_fields: {
    name: "Research Fields",
    operations: {
      researchFieldsList: {
        type: "query",
        name: "List Research Fields",
        description: "Retrieves all research fields with optional filtering by project",
        variables: {
          projectId: "Optional ID of project to filter by"
        },
        query: `query ListResearchFields($projectId: String) {
  research_fields(
    where: { project_id: { eq: $projectId } }
  ) {
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
        content
      }
      description {
        content
      }
    }
  }
}`
      },
      researchFieldsGetById: {
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
      main_asset
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
      researchFieldsCreate: {
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
  insertIntoTexts(values: [{
    content: $name,
    context: "research_fields.name",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["name", "languageCode"]
          },
          {
            name: "createDescriptionText",
            query: `mutation CreateResearchFieldDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $description,
    context: "research_fields.description",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["description", "languageCode"]
          },
          {
            name: "createResearchField",
            query: `mutation CreateResearchFieldEntry($nameId: String!, $descriptionId: String!, $projectId: String!, $type: String) {
  insertIntoResearch_fields(values: [{
    name_id: $nameId,
    description_id: $descriptionId,
    project_id: $projectId,
    type: $type
  }]) {
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
      researchFieldsUpdate: {
        type: "mutation",
        name: "Update Research Field",
        description: "Updates an existing research field",
        variables: {
          fieldId: "ID of the research field to update",
          name: "New name content (optional)",
          description: "New description content (optional)",
          type: "New field type (optional)"
        },
        query: `mutation UpdateResearchField(
  $fieldId: String!, 
  $name: String, 
  $description: String, 
  $type: String
) {
  # Update the name text
  updateName: updateTexts(
    set: { content: $name }
    where: { id: { eq: $fieldId } }
  ) {
    id
    content
  }
  
  # Update the description text
  updateDescription: updateTexts(
    set: { content: $description }
    where: { id: { eq: $fieldId } }
  ) {
    id
    content
  }
  
  # Update the type
  updateType: updateResearch_fields(
    set: { type: $type }
    where: { id: { eq: $fieldId } }
  ) {
    id
    type
  }
}`
      },
      researchFieldsDelete: {
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
      researchFieldsAddVocabulary: {
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
  insertIntoTexts(values: [{
    content: $option,
    context: "vocabularies.option",
    original_language: $languageCode
  }]) {
    id
  }
}`,
            useVariables: ["option", "languageCode"]
          },
          {
            name: "createDescriptionText",
            query: `mutation CreateVocabularyDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $description,
    context: "vocabularies.description",
    original_language: $languageCode
  }]) {
    id
  }
}`,
            useVariables: ["description", "languageCode"]
          },
          {
            name: "createVocabulary",
            query: `mutation CreateVocabularyEntry($optionId: String!, $descriptionId: String!, $fieldId: String!, $mainAsset: String, $otherAssets: String) {
  insertIntoVocabularies(values: [{
    option_id: $optionId,
    description_id: $descriptionId,
    field_id: $fieldId,
    main_asset: $mainAsset,
    other_assets: $otherAssets
  }]) {
    id
    option_id
    description_id
    field_id
    main_asset
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
      researchFieldsDeleteVocabulary: {
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
    }
  },
  ontology_fields: {
    name: "Ontology Fields",
    operations: {
      ontologyFieldsList: {
        type: "query",
        name: "List Ontology Fields",
        description: "Retrieves all ontology fields",
        query: `{
  result: ontology_fields {
    id
    created_at
    updated_at
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
    category {
      id
      content
      original_language
      translations {
        language_code
        content
      }
    }
    embeddings
  }
}`
      },
      ontologyFieldsGetById: {
        type: "query",
        name: "Get Ontology Field by ID",
        description: "Retrieves a single ontology field by its ID",
        variables: {
          fieldId: "ID of the ontology field to retrieve"
        },
        query: `query GetOntologyField($fieldId: String!) {
  result: ontology_fields(where: { id: { eq: $fieldId } }) {
    id
    created_at
    updated_at
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
    category {
      id
      content
      original_language
      translations {
        language_code
        content
      }
    }
    embeddings
  }
}`
      },
      ontologyFieldsCreate: {
        type: "mutation",
        name: "Create Ontology Field",
        description: "Creates a new ontology field with name, description, and category",
        variables: {
          languageCode: "Language code for the initial text",
          name: "Name of the ontology field",
          description: "Description of the ontology field",
          category: "Category of the ontology field",
          embeddings: "Embeddings data (optional)"
        },
        mutations: [
          {
            name: "createNameText",
            query: `mutation CreateOntologyFieldName($name: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $name,
    context: "ontology_fields.name",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["name", "languageCode"]
          },
          {
            name: "createDescriptionText",
            query: `mutation CreateOntologyFieldDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $description,
    context: "ontology_fields.description",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["description", "languageCode"]
          },
          {
            name: "createCategoryText",
            query: `mutation CreateOntologyFieldCategory($category: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $category,
    context: "ontology_fields.category",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["category", "languageCode"]
          },
          {
            name: "createOntologyField",
            query: `mutation CreateOntologyFieldEntry($nameId: String!, $descriptionId: String!, $categoryId: String!, $embeddings: String) {
  insertIntoOntology_fields(values: [{
    name_id: $nameId,
    description_id: $descriptionId,
    category_id: $categoryId,
    embeddings: $embeddings
  }]) {
    id
    name_id
    description_id
    category_id
    embeddings
  }
}`,
            useVariables: ["embeddings"],
            mapVariables: {
              nameId: { from: "createNameText", path: "insertIntoTexts.0.id" },
              descriptionId: { from: "createDescriptionText", path: "insertIntoTexts.0.id" },
              categoryId: { from: "createCategoryText", path: "insertIntoTexts.0.id" }
            }
          }
        ],
        query: null
      },
      ontologyFieldsUpdate: {
        type: "mutation",
        name: "Update Ontology Field",
        description: "Updates an existing ontology field",
        variables: {
          fieldId: "ID of the ontology field to update",
          name: "New name content (optional)",
          description: "New description content (optional)",
          category: "New category content (optional)",
          embeddings: "New embeddings data (optional)"
        },
        query: `mutation UpdateOntologyField(
  $fieldId: String!, 
  $name: String, 
  $description: String, 
  $category: String, 
  $embeddings: String
) {
  # Update the name text
  updateName: updateTexts(
    set: { content: $name }
    where: { id: { eq: $fieldId } }
  ) {
    id
    content
  }
  
  # Update the description text
  updateDescription: updateTexts(
    set: { content: $description }
    where: { id: { eq: $fieldId } }
  ) {
    id
    content
  }
  
  # Update the category text
  updateCategory: updateTexts(
    set: { content: $category }
    where: { id: { eq: $fieldId } }
  ) {
    id
    content
  }
  
  # Update the embeddings
  updateEmbeddings: updateOntology_fields(
    set: { embeddings: $embeddings }
    where: { id: { eq: $fieldId } }
  ) {
    id
    embeddings
  }
}`
      },
      ontologyFieldsDelete: {
        type: "mutation",
        name: "Delete Ontology Field",
        description: "Deletes an ontology field by ID",
        variables: {
          fieldId: "ID of the ontology field to delete"
        },
        query: `mutation DeleteOntologyField($fieldId: String!) {
  deleteFromOntology_fields(where: { id: { eq: $fieldId } }) {
    id
    name_id
    description_id
    category_id
  }
}`
      }
    }
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
  },
  settings: {
    name: "Project Settings",
    operations: {
      settingsGetByProjectId: {
        type: "query",
        name: "Get Settings by Project ID",
        description: "Retrieves settings for a specific project",
        variables: {
          projectId: "ID of the project"
        },
        query: `query GetProjectSettings($projectId: String!) {
  result: settings(where: { project_id: { eq: $projectId } }) {
    id
    project_id
    username
    password
    sync_url
    sig_server
    created_at
    updated_at
  }
}`
      },
      settingsCreate: {
        type: "mutation",
        name: "Create Project Settings",
        description: "Creates settings for a project",
        variables: {
          projectId: "ID of the project",
          username: "Username for database connection",
          password: "Password for database connection",
          syncUrl: "Synchronization URL",
          sigServer: "Signature server URL"
        },
        query: `mutation CreateProjectSettings($projectId: String!, $username: String, $password: String, $syncUrl: String, $sigServer: String) {
  insertIntoSettings(values: [{
    project_id: $projectId,
    username: $username,
    password: $password,
    sync_url: $syncUrl,
    sig_server: $sigServer
  }]) {
    id
    project_id
    username
    password
    sync_url
    sig_server
    created_at
    updated_at
  }
}`
      },
      settingsUpdate: {
        type: "mutation",
        name: "Update Project Settings",
        description: "Updates existing project settings",
        variables: {
          settingsId: "ID of the settings to update",
          username: "Username for database connection (optional)",
          password: "Password for database connection (optional)",
          syncUrl: "Synchronization URL (optional)",
          sigServer: "Signature server URL (optional)"
        },
        query: `mutation UpdateProjectSettings(
  $settingsId: String!, 
  $username: String, 
  $password: String, 
  $syncUrl: String, 
  $sigServer: String
) {
  updateSettings(
    set: { 
      username: $username,
      password: $password,
      sync_url: $syncUrl,
      sig_server: $sigServer
    }
    where: { id: { eq: $settingsId } }
  ) {
    id
    project_id
    username
    password
    sync_url
    sig_server
    updated_at
  }
}`
      },
      settingsUpdateByProjectId: {
        type: "mutation",
        name: "Update Project Settings by Project ID",
        description: "Updates settings for a project by project ID",
        variables: {
          projectId: "ID of the project",
          username: "Username for database connection (optional)",
          password: "Password for database connection (optional)",
          syncUrl: "Synchronization URL (optional)",
          sigServer: "Signature server URL (optional)"
        },
        query: `mutation UpdateProjectSettingsByProjectId(
  $projectId: String!, 
  $username: String, 
  $password: String, 
  $syncUrl: String, 
  $sigServer: String
) {
  updateSettings(
    set: { 
      username: $username,
      password: $password,
      sync_url: $syncUrl,
      sig_server: $sigServer
    }
    where: { project_id: { eq: $projectId } }
  ) {
    id
    project_id
    username
    password
    sync_url
    sig_server
    updated_at
  }
}`
      },
      settingsDelete: {
        type: "mutation",
        name: "Delete Project Settings",
        description: "Deletes project settings by ID",
        variables: {
          settingsId: "ID of the settings to delete"
        },
        query: `mutation DeleteProjectSettings($settingsId: String!) {
  deleteFromSettings(where: { id: { eq: $settingsId } }) {
    id
    project_id
  }
}`
      },
      settingsDeleteByProjectId: {
        type: "mutation",
        name: "Delete Project Settings by Project ID",
        description: "Deletes settings for a project by project ID",
        variables: {
          projectId: "ID of the project"
        },
        query: `mutation DeleteProjectSettingsByProjectId($projectId: String!) {
  deleteFromSettings(where: { project_id: { eq: $projectId } }) {
    id
    project_id
  }
}`
      }
    }
  }
}; 