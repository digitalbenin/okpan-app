export const templatesOperations = {
    // Get all templates for an institution
    getByInstitution: {
        type: "query",
        name: "Get Templates by Institution",
        description: "Retrieves all templates for a specific institution with datasource details",
        variables: {
            institutionId: "ID of the institution"
        },
        query: `query GetTemplatesByInstitution($institutionId: String!) {
      templates(where: { institution_id: { eq: $institutionId } }) {
        id
        name
        config
        institution_id
        datasource_id
        asset_map_rule
        created_at
        updated_at
        datasource {
          id
          language
          date
          name {
            content
          }
          method {
            content
          }
        }
      }
    }`
    },

    // Get templates by datasource
    getByDatasource: {
        type: "query",
        name: "Get Templates by Datasource",
        description: "Retrieves all templates for a specific datasource",
        variables: {
            datasourceId: "ID of the datasource"
        },
        query: `query GetTemplatesByDatasource($datasourceId: String!) {
      templates(where: { datasource_id: { eq: $datasourceId } }) {
        id
        name
        config
        institution_id
        datasource_id
        asset_map_rule
        created_at
        updated_at
        datasource {
          id
          language
          date
          name {
            content
          }
          method {
            content
          }
        }
      }
    }`
    },

    // Get single template by ID
    getById: {
        type: "query",
        name: "Get Template by ID",
        description: "Retrieves a single template by its ID with full details",
        variables: {
            templateId: "ID of the template"
        },
        query: `query GetTemplateById($templateId: String!) {
      templates(where: { id: { eq: $templateId } }) {
        id
        name
        config
        institution_id
        datasource_id
        asset_map_rule
        created_at
        updated_at
        institution {
          id
          name {
            content
          }
        }
        datasource {
          id
          language
          date
          name {
            content
          }
          method {
            content
          }
        }
      }
    }`
    },

    // Create new template
    create: {
        type: "mutation",
        name: "Create Template",
        description: "Creates a new template",
        variables: {
            name: "Template name",
            config: "Template configuration as JSON",
            institutionId: "ID of the institution",
            datasourceId: "ID of the datasource",
            assetMapRule: "Asset mapping rule (optional)"
        },
        query: `mutation CreateTemplate(
      $name: String!
      $config: String!
      $institutionId: String!
      $datasourceId: String!
      $assetMapRule: String
    ) {
      insertIntoTemplates(objects: [{
        name: $name
        config: $config
        institution_id: $institutionId
        datasource_id: $datasourceId
        asset_map_rule: $assetMapRule
      }]) {
        id
        name
        config
        institution_id
        datasource_id
        asset_map_rule
        created_at
      }
    }`
    },

    // Update template
    update: {
        type: "mutation",
        name: "Update Template",
        description: "Updates an existing template",
        variables: {
            templateId: "ID of the template to update",
            name: "New template name (optional)",
            config: "New template configuration as JSON (optional)",
            assetMapRule: "New asset mapping rule (optional)"
        },
        query: `mutation UpdateTemplate(
      $templateId: String!
      $name: String
      $config: String
      $assetMapRule: String
    ) {
      updateTemplates(
        set: {
          name: $name
          config: $config
          asset_map_rule: $assetMapRule
        }
        where: { id: { eq: $templateId } }
      ) {
        id
        name
        config
        asset_map_rule
        updated_at
      }
    }`
    },

    // Delete template
    delete: {
        type: "mutation",
        name: "Delete Template",
        description: "Deletes a template by ID",
        variables: {
            templateId: "ID of the template to delete"
        },
        query: `mutation DeleteTemplate($templateId: String!) {
      deleteFromTemplates(where: { id: { eq: $templateId } }) {
        id
        name
      }
    }`
    }
}; 