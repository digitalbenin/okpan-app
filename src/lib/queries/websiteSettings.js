export const websiteSettingsOperations = {
  // GET BY PROJECT ID
  getByProjectId: {
    type: "query",
    name: "Get Website Settings by Project ID",
    description: "Retrieves website settings for a specific project",
    variables: {
      projectId: "ID of the project"
    },
    query: `query GetWebsiteSettingsByProjectId($projectId: String!) {
  result: websiteSettings(where: { project_id: { eq: $projectId } }) {
    id
    project_id
    title_id
    about_id
    authors
    logo_id
    subfolder_path
    show_unmapped
    created_at
    updated_at
    title {
      id
      content
      original_language_id
      translations {
        id
        content
        language_id
        language {
          id
          code
          name
        }
      }
    }
    about {
      id
      content
      original_language_id
      translations {
        id
        content
        language_id
        language {
          id
          code
          name
        }
      }
    }
    logo {
      id
      filename
      path
      type
      formats
    }
  }
}`
  },

  // CREATE (simplified, matches style of institutions.js)
  create: {
    type: "mutation",
    name: "Create Website Settings",
    description: "Creates website settings for a project with translatable fields",
    variables: {
      projectId: "ID of the project",
      title: "Title content",
      about: "About content",
      authors: "Authors text",
      subfolderPath: "Subfolder path for website",
      showUnmapped: "Whether to show unmapped objects (boolean)",
      languageId: "Default language ID for creating text entries",
      logoId: "Generic asset ID for logo (optional)",
      // Translation arrays
      titleTranslations: "Array of title translations (optional)",
      aboutTranslations: "Array of about translations (optional)"
    },
    mutations: [
      {
        name: "createTitleText",
        query: `mutation CreateTitleText($title: String!, $languageId: String!) {
  insertIntoTexts(
    values: [{
      content: $title,
      context: "website_settings.title",
      original_language_id: $languageId
    }]
  ) {
    id
    content
  }
}`,
        useVariables: ["title", "languageId"],
        skipIf: { variableName: "title", isEmpty: true }
      },
      {
        name: "createAboutText",
        query: `mutation CreateAboutText($about: String!, $languageId: String!) {
  insertIntoTexts(
    values: [{
      content: $about,
      context: "website_settings.about",
      original_language_id: $languageId
    }]
  ) {
    id
    content
  }
}`,
        useVariables: ["about", "languageId"],
        skipIf: { variableName: "about", isEmpty: true }
      },
      {
        name: "createWebsiteSettings",
        query: `mutation CreateWebsiteSettings(
  $projectId: String!
  $titleId: String
  $aboutId: String
  $authors: String
  $subfolderPath: String
  $showUnmapped: Int
  $logoId: String
) {
  insertIntoWebsiteSettings(
    values: [{
      project_id: $projectId
      title_id: $titleId
      about_id: $aboutId
      authors: $authors
      subfolder_path: $subfolderPath
      show_unmapped: $showUnmapped
      logo_id: $logoId
    }]
  ) {
    id
    project_id
    title_id
    about_id
    authors
    subfolder_path
    show_unmapped
    logo_id
    created_at
    updated_at
  }
}`,
        useVariables: ["projectId", "authors", "subfolderPath", "showUnmapped", "logoId"],
        mapVariables: {
          titleId: { from: "createTitleText", path: "insertIntoTexts.0.id" },
          aboutId: { from: "createAboutText", path: "insertIntoTexts.0.id" }
        }
      },
      // Process translations only when base texts exist
      {
        name: "processTitleTranslations",
        processTranslations: {
          textIdPath: "createTitleText.insertIntoTexts.0.id",
          translationsParam: "titleTranslations"
        },
        onlyIf: { from: "createTitleText", path: "insertIntoTexts.0.id", isNull: false }
      },
      {
        name: "processAboutTranslations",
        processTranslations: {
          textIdPath: "createAboutText.insertIntoTexts.0.id",
          translationsParam: "aboutTranslations"
        },
        onlyIf: { from: "createAboutText", path: "insertIntoTexts.0.id", isNull: false }
      }
    ],
    query: null
  },

  // UPDATE (simplified to match institutions.js pattern)
  update: {
    type: "mutation",
    name: "Update Website Settings",
    description: "Updates existing website settings by ID",
    variables: {
      id: "ID of the website settings to update",
      title: "New title content (optional)",
      about: "New about content (optional)",
      authors: "New authors text (optional)",
      subfolderPath: "New subfolder path (optional)",
      showUnmapped: "New show unmapped setting (optional)",
      languageId: "Default language ID for creating new text entries (optional)",
      logoId: "Generic asset ID for logo (optional)",
      // Translation arrays
      titleTranslations: "Array of title translations (optional)",
      aboutTranslations: "Array of about translations (optional)"
    },
    mutations: [
      {
        name: "getWebsiteSettings",
        query: `query GetWebsiteSettingsForUpdate($id: String!) {
  websiteSettings(where: { id: { eq: $id } }) {
    id
    title_id
    about_id
    authors
    logo_id
    subfolder_path
    show_unmapped
    created_at
    updated_at
    title {
      id
      content
      original_language_id
      translations { id content language_id }
    }
    about {
      id
      content
      original_language_id
      translations { id content language_id }
    }
  }
}`,
        useVariables: ["id"]
      },
      {
        name: "updateTitle",
        query: `mutation UpdateWebsiteSettingsTitle($titleId: String!, $title: String!) {
  updateTexts(
    set: { content: $title }
    where: { id: { eq: $titleId } }
  ) {
    id
    content
  }
}`,
        useVariables: ["title"],
        mapVariables: {
          titleId: { from: "getWebsiteSettings", path: "websiteSettings.0.title.id" }
        },
        skipIf: { variableName: "title", isEmpty: true }
      },
      {
        name: "updateAbout",
        query: `mutation UpdateWebsiteSettingsAbout($aboutId: String!, $about: String!) {
  updateTexts(
    set: { content: $about }
    where: { id: { eq: $aboutId } }
  ) {
    id
    content
  }
}`,
        useVariables: ["about"],
        mapVariables: {
          aboutId: { from: "getWebsiteSettings", path: "websiteSettings.0.about.id" }
        },
        skipIf: { variableName: "about", isEmpty: true }
      },
      // Create and link texts if missing and base content provided
      {
        name: "createTitleTextIfMissing",
        query: `mutation CreateTitleTextIfMissing($title: String!, $languageId: String!) {
  insertIntoTexts(
    values: [{ content: $title, context: "website_settings.title", original_language_id: $languageId }]
  ) {
    id
    content
  }
}`,
        useVariables: ["title", "languageId"],
        onlyIf: { from: "getWebsiteSettings", path: "websiteSettings.0.title", isNull: true },
        skipIf: { variableName: "title", isEmpty: true }
      },
      {
        name: "linkNewTitleText",
        query: `mutation LinkNewTitleText($id: String!, $titleId: String!) {
  updateWebsiteSettings(
    set: { title_id: $titleId }
    where: { id: { eq: $id } }
  ) { id title_id }
}`,
        useVariables: ["id"],
        mapVariables: {
          titleId: { from: "createTitleTextIfMissing", path: "insertIntoTexts.0.id" }
        },
        skipIf: { variableName: "titleId", isUndefined: true }
      },
      {
        name: "createAboutTextIfMissing",
        query: `mutation CreateAboutTextIfMissing($about: String!, $languageId: String!) {
  insertIntoTexts(
    values: [{ content: $about, context: "website_settings.about", original_language_id: $languageId }]
  ) {
    id
    content
  }
}`,
        useVariables: ["about", "languageId"],
        onlyIf: { from: "getWebsiteSettings", path: "websiteSettings.0.about", isNull: true },
        skipIf: { variableName: "about", isEmpty: true }
      },
      {
        name: "linkNewAboutText",
        query: `mutation LinkNewAboutText($id: String!, $aboutId: String!) {
  updateWebsiteSettings(
    set: { about_id: $aboutId }
    where: { id: { eq: $id } }
  ) { id about_id }
}`,
        useVariables: ["id"],
        mapVariables: {
          aboutId: { from: "createAboutTextIfMissing", path: "insertIntoTexts.0.id" }
        },
        skipIf: { variableName: "aboutId", isUndefined: true }
      },
      // Update scalar fields
      {
        name: "updateWebsiteSettingsFields",
        query: `mutation UpdateWebsiteSettingsFields(
  $id: String!
  $authors: String
  $subfolderPath: String
  $showUnmapped: Int
  $logoId: String
) {
  updateWebsiteSettings(
    set: { 
      authors: $authors,
      subfolder_path: $subfolderPath,
      show_unmapped: $showUnmapped,
      logo_id: $logoId
    }
    where: { id: { eq: $id } }
  ) { id authors subfolder_path show_unmapped logo_id }
}`,
        useVariables: ["authors", "subfolderPath", "showUnmapped", "logoId"],
        mapVariables: {
          id: { from: "getWebsiteSettings", path: "websiteSettings.0.id" }
        }
      },
      // Process translations using existing text IDs
      {
        name: "processTitleTranslations",
        processTranslations: {
          textIdPath: "getWebsiteSettings.websiteSettings.0.title.id",
          translationsParam: "titleTranslations"
        }
      },
      {
        name: "processAboutTranslations",
        processTranslations: {
          textIdPath: "getWebsiteSettings.websiteSettings.0.about.id",
          translationsParam: "aboutTranslations"
        }
      }
    ],
    query: null
  },

  // DELETE BY PROJECT ID
  deleteByProjectId: {
    type: "mutation",
    name: "Delete Website Settings by Project ID",
    description: "Deletes website settings for a project by project ID",
    variables: {
      projectId: "ID of the project"
    },
    query: `mutation DeleteWebsiteSettingsByProjectId($projectId: String!) {
  deleteFromWebsiteSettings(where: { project_id: { eq: $projectId } }) {
    id
    project_id
  }
}`
  }
};