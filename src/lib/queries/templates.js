export const templatesOperations = {
  // Get all templates
  list: {
    type: "query",
    name: "Get All Templates",
    description: "Retrieves all templates with datasource details",
    variables: {},
    query: `query GetAllTemplates {
      result:templates {
        id
        mapping
        project_id
        asset_map_rule
        created_at
        updated_at
        datasources {
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

  // Get templates by project
  getByProject: {
    type: "query",
    name: "Get Templates by Project",
    description: "Retrieves all templates for a specific project",
    variables: {
      projectId: "ID of the project"
    },
    query: `query GetTemplatesByProject($projectId: String!) {
      result:templates(where: { project_id: { eq: $projectId } }) {
        id
        mapping
        project_id
        asset_map_rule
        created_at
        updated_at
        datasources {
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

  // Get template by datasource (since datasource now maps to single template)
  getByDatasource: {
    type: "query",
    name: "Get Template by Datasource",
    description: "Retrieves the template for a specific datasource",
    variables: {
      datasourceId: "ID of the datasource"
    },
    query: `query GetTemplateByDatasource($datasourceId: String!) {
      result:datasources(where: { id: { eq: $datasourceId } }) {
        id
        template {
          id
          mapping
          project_id
          asset_map_rule
          created_at
          updated_at
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
      result:templates(where: { id: { eq: $templateId } }) {
        id
        mapping
        project_id
        asset_map_rule
        created_at
        updated_at
        datasources {
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
      mapping: "Template mapping configuration as JSON",
      projectId: "Project ID",
      assetMapRule: "Asset mapping rule (optional)"
    },
    query: `mutation CreateTemplate(
      $mapping: String!
      $projectId: String!
      $assetMapRule: String
    ) {
      result:insertIntoTemplates(values: [{
        mapping: $mapping
        project_id: $projectId
        asset_map_rule: $assetMapRule
      }]) {
        id
        mapping
        project_id
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
      mapping: "New template mapping configuration as JSON (optional)",
      assetMapRule: "New asset mapping rule (optional)"
    },
    query: `mutation UpdateTemplate(
      $templateId: String!
      $mapping: String
      $assetMapRule: String
    ) {
      result:updateTemplates(
        set: {
          mapping: $mapping
          asset_map_rule: $assetMapRule
        }
        where: { id: { eq: $templateId } }
      ) {
        id
        mapping
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
      result:deleteFromTemplates(where: { id: { eq: $templateId } }) {
        id
      }
    }`
  }
}; 