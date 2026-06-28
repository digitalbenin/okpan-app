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
    short_description_id
    about_id
    authors
    logo_id
    subfolder_path
    show_unmapped
    filters
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
    shortDescription {
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
      shortDescription: "Short description content",
      about: "About content",
      authors: "Authors text",
      subfolderPath: "Subfolder path for website",
      showUnmapped: "Whether to show unmapped objects (boolean)",
      languageId: "Default language ID for creating text entries",
      logoId: "Generic asset ID for logo (optional)",
      // Translation arrays
      titleTranslations: "Array of title translations (optional)",
      shortDescriptionTranslations: "Array of short description translations (optional)",
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
        name: "createShortDescriptionText",
        query: `mutation CreateShortDescriptionText($shortDescription: String!, $languageId: String!) {
  insertIntoTexts(
    values: [{
      content: $shortDescription,
      context: "website_settings.short_description",
      original_language_id: $languageId
    }]
  ) {
    id
    content
  }
}`,
        useVariables: ["shortDescription", "languageId"],
        skipIf: { variableName: "shortDescription", isEmpty: true }
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
  $shortDescriptionId: String
  $aboutId: String
  $authors: String
  $subfolderPath: String
  $showUnmapped: Int
  $logoId: String
  $filters: JSON
) {
  insertIntoWebsiteSettings(
    values: [{
      project_id: $projectId
      title_id: $titleId
      short_description_id: $shortDescriptionId
      about_id: $aboutId
      authors: $authors
      subfolder_path: $subfolderPath
      show_unmapped: $showUnmapped
      logo_id: $logoId
      filters: $filters
    }]
  ) {
    id
    project_id
    title_id
    short_description_id
    about_id
    authors
    subfolder_path
    show_unmapped
    logo_id
    filters
    created_at
    updated_at
  }
}`,
        useVariables: ["projectId", "authors", "subfolderPath", "showUnmapped", "logoId", "filters"],
        mapVariables: {
          titleId: { from: "createTitleText", path: "insertIntoTexts.0.id" },
          shortDescriptionId: { from: "createShortDescriptionText", path: "insertIntoTexts.0.id" },
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
        name: "processShortDescriptionTranslations",
        processTranslations: {
          textIdPath: "createShortDescriptionText.insertIntoTexts.0.id",
          translationsParam: "shortDescriptionTranslations"
        },
        onlyIf: { from: "createShortDescriptionText", path: "insertIntoTexts.0.id", isNull: false }
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
      shortDescription: "New short description content (optional)",
      about: "New about content (optional)",
      authors: "New authors text (optional)",
      subfolderPath: "New subfolder path (optional)",
      showUnmapped: "New show unmapped setting (optional)",
      languageId: "Default language ID for creating new text entries (optional)",
      logoId: "Generic asset ID for logo (optional)",
      // Translation arrays
      titleTranslations: "Array of title translations (optional)",
      shortDescriptionTranslations: "Array of short description translations (optional)",
      aboutTranslations: "Array of about translations (optional)"
    },
    mutations: [
      {
        name: "getWebsiteSettings",
        query: `query GetWebsiteSettingsForUpdate($id: String!) {
  websiteSettings(where: { id: { eq: $id } }) {
    id
    title_id
    short_description_id
    about_id
    authors
    logo_id
    subfolder_path
    show_unmapped
    filters
    created_at
    updated_at
    title {
      id
      content
      original_language_id
      translations { id content language_id }
    }
    shortDescription {
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
      // --- Title: create if missing, link, then update ---
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
        onlyIf: { from: "getWebsiteSettings", path: "websiteSettings.0.title", isNull: true }
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
      // --- Short description: create if missing, link, then update ---
      {
        name: "createShortDescriptionTextIfMissing",
        query: `mutation CreateShortDescriptionTextIfMissing($shortDescription: String!, $languageId: String!) {
  insertIntoTexts(
    values: [{ content: $shortDescription, context: "website_settings.short_description", original_language_id: $languageId }]
  ) {
    id
    content
  }
}`,
        useVariables: ["shortDescription", "languageId"],
        onlyIf: { from: "getWebsiteSettings", path: "websiteSettings.0.shortDescription", isNull: true }
      },
      {
        name: "linkNewShortDescriptionText",
        query: `mutation LinkNewShortDescriptionText($id: String!, $shortDescriptionId: String!) {
  updateWebsiteSettings(
    set: { short_description_id: $shortDescriptionId }
    where: { id: { eq: $id } }
  ) { id short_description_id }
}`,
        useVariables: ["id"],
        mapVariables: {
          shortDescriptionId: { from: "createShortDescriptionTextIfMissing", path: "insertIntoTexts.0.id" }
        },
        skipIf: { variableName: "shortDescriptionId", isUndefined: true }
      },
      {
        name: "updateShortDescription",
        query: `mutation UpdateWebsiteSettingsShortDescription($shortDescriptionId: String!, $shortDescription: String!) {
  updateTexts(
    set: { content: $shortDescription }
    where: { id: { eq: $shortDescriptionId } }
  ) {
    id
    content
  }
}`,
        useVariables: ["shortDescription"],
        mapVariables: {
          shortDescriptionId: { from: "getWebsiteSettings", path: "websiteSettings.0.shortDescription.id" }
        },
        skipIf: { variableName: "shortDescription", isEmpty: true }
      },
      // --- About: create if missing, link, then update ---
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
        onlyIf: { from: "getWebsiteSettings", path: "websiteSettings.0.about", isNull: true }
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
      // Update scalar fields
      {
        name: "updateWebsiteSettingsScalarFields",
        query: `mutation UpdateWebsiteSettingsScalarFields(
  $id: String!
  $authors: String
  $subfolderPath: String
  $showUnmapped: Int
  $filters: JSON
) {
  updateWebsiteSettings(
    set: { 
      authors: $authors,
      subfolder_path: $subfolderPath,
      show_unmapped: $showUnmapped,
      filters: $filters
    }
    where: { id: { eq: $id } }
  ) { id authors subfolder_path show_unmapped filters }
}`,
        useVariables: ["authors", "subfolderPath", "showUnmapped", "filters"],
        mapVariables: {
          id: { from: "getWebsiteSettings", path: "websiteSettings.0.id" }
        }
      },
      {
        name: "updateWebsiteLogo",
        query: `mutation UpdateWebsiteLogo(
  $id: String!
  $logoId: String
) {
  updateWebsiteSettings(
    set: { logo_id: $logoId }
    where: { id: { eq: $id } }
  ) { id logo_id }
}`,
        useVariables: ["logoId"],
        mapVariables: {
          id: { from: "getWebsiteSettings", path: "websiteSettings.0.id" }
        },
        skipIf: { variableName: "logoId", isUndefined: true }
      },
      // Process translations using existing text IDs
      {
        name: "processTitleTranslations",
        processTranslations: {
          textIdPaths: [
            "getWebsiteSettings.websiteSettings.0.title.id",
            "createTitleTextIfMissing.insertIntoTexts.0.id"
          ],
          translationsParam: "titleTranslations"
        }
      },
      {
        name: "processShortDescriptionTranslations",
        processTranslations: {
          textIdPaths: [
            "getWebsiteSettings.websiteSettings.0.shortDescription.id",
            "createShortDescriptionTextIfMissing.insertIntoTexts.0.id"
          ],
          translationsParam: "shortDescriptionTranslations"
        }
      },
      {
        name: "processAboutTranslations",
        processTranslations: {
          textIdPaths: [
            "getWebsiteSettings.websiteSettings.0.about.id",
            "createAboutTextIfMissing.insertIntoTexts.0.id"
          ],
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