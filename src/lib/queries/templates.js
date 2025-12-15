export const templatesOperations = {
  // Get all templates
  list: {
    type: "query",
    name: "Get All Templates",
    description: "Retrieves all templates",
    variables: {},
    query: `query GetAllTemplates {
      result:templates {
        id
        name
        mapping
        project_id
        institution_id
        asset_map_rule
        created_at
        updated_at
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
        name
        mapping
        project_id
        institution_id
        asset_map_rule
        created_at
        updated_at
      }
    }`
  },

  // Get templates by institution
  getByInstitution: {
    type: "query",
    name: "Get Templates by Institution",
    description: "Retrieves all templates for a specific institution",
    variables: {
      institutionId: "ID of the institution"
    },
    query: `query GetTemplatesByInstitution($institutionId: String!) {
      result:templates(where: { institution_id: { eq: $institutionId } }) {
        id
        name
        mapping
        project_id
        institution_id
        asset_map_rule
        created_at
        updated_at
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
        name
        mapping
        project_id
        institution_id
        asset_map_rule
        created_at
        updated_at
      }
    }`
  },

  // Create new template
  create: {
    type: "mutation",
    name: "Create Template",
    description: "Creates a new template",
    variables: {
      name: "Template name (simple text)",
      mapping: "Template mapping configuration as JSON",
      projectId: "Project ID",
      institutionId: "Institution ID (optional)",
      assetMapRule: "Asset mapping rule (optional)"
    },
    query: `mutation CreateTemplate(
      $name: String
      $mapping: JSON!
      $projectId: String!
      $institutionId: String
      $assetMapRule: String
    ) {
      result:insertIntoTemplates(values: [{
        name: $name
        mapping: $mapping
        project_id: $projectId
        institution_id: $institutionId
        asset_map_rule: $assetMapRule
      }]) {
        id
        name
        mapping
        project_id
        institution_id
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
      name: "Template name (simple text) (optional)",
      mapping: "New template mapping configuration as JSON (optional)",
      institutionId: "New institution ID (optional)",
      assetMapRule: "New asset mapping rule (optional)"
    },
    query: `mutation UpdateTemplate(
      $templateId: String!
      $name: String
      $mapping: JSON
      $institutionId: String
      $assetMapRule: String
    ) {
      result:updateTemplates(
        set: {
          name: $name
          mapping: $mapping
          institution_id: $institutionId
          asset_map_rule: $assetMapRule
        }
        where: { id: { eq: $templateId } }
      ) {
        id
        name
        mapping
        institution_id
        asset_map_rule
        updated_at
      }
    }`
  },

  // Get templates used by a specific datasource (via objects_datasources junction)
  getByDatasource: {
    type: "query",
    name: "Get Templates by Datasource",
    description: "Retrieves templates that have been used with a specific datasource via the objects_datasources junction table",
    variables: {
      datasourceId: "ID of the datasource"
    },
    query: `query GetTemplatesByDatasource($datasourceId: String!) {
      result:objects_datasources(where: { datasource_id: { eq: $datasourceId } }) {
        template_id
        template {
          id
          name
          mapping
          project_id
          institution_id
          asset_map_rule
          created_at
          updated_at
        }
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