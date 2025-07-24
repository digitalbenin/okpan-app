export const objectDisplayFieldsOperations = {
  create: {
    type: "mutation",
    name: "Create Object Display Field",
    description: "Creates a new object display field configuration for a project",
    variables: {
      projectId: "ID of the project (required)",
      ontologyFieldId: "ID of the ontology field (optional)",
      researchFieldId: "ID of the research field (optional)",
      propertyName: "Name of the object property (optional, e.g., 'created_at', 'updated_at', 'status')"
    },
    query: `mutation CreateObjectDisplayField($projectId: String!, $ontologyFieldId: String, $researchFieldId: String, $propertyName: String) {
  insertIntoObject_display_fields(values: [{ 
    project_id: $projectId,
    ontology_field_id: $ontologyFieldId,
    research_field_id: $researchFieldId,
    property_name: $propertyName
  }]) {
    id
    project_id
    ontology_field_id
    research_field_id
    property_name
    created_at
    updated_at
  }
}`
  },
  delete: {
    type: "mutation",
    name: "Delete Object Display Field",
    description: "Deletes an object display field configuration by its ID",
    variables: {
      fieldId: "Object display field ID to delete"
    },
    query: `mutation DeleteObjectDisplayField($fieldId: String!) {
  deleteFromObject_display_fields(where: { id: { eq: $fieldId } }) {
    id
    project_id
    ontology_field_id
    research_field_id
    property_name
  }
}`
  },
  rawlist: {
    type: "query",
    name: "List Object Display Fields (raw)",
    description: "Lists all object display field configurations",
    query: `{
  result: object_display_fields {
    id
    project_id
    ontology_field_id
    research_field_id
    property_name
    created_at
    updated_at
  }
}`
  },
  listByProject: {
    type: "query",
    name: "List Object Display Fields by Project",
    description: "Lists all object display field configurations for a specific project",
    variables: {
      projectId: "ID of the project"
    },
    query: `query GetProjectObjectDisplayFields($projectId: String!) {
  result: object_display_fields(where: { project_id: { eq: $projectId } }) {
    id
    project_id
    ontology_field_id
    research_field_id
    property_name
    created_at
    updated_at
    ontologyField {
      id
      name {
        content
        translations {
          language_id
          content
        }
      }
    }
    researchField {
      id
      name {
        content
        translations {
          language_id
          content
        }
      }
    }
  }
}`
  },
  deleteByProject: {
    type: "mutation",
    name: "Delete All Object Display Fields for Project",
    description: "Deletes all object display field configurations for a specific project",
    variables: {
      projectId: "ID of the project"
    },
    query: `mutation DeleteProjectObjectDisplayFields($projectId: String!) {
  deleteFromObject_display_fields(where: { project_id: { eq: $projectId } }) {
    id
    project_id
  }
}`
  },
  list: {
    type: "query",
    name: "List Object Display Fields (Transformed)",
    description: "Lists object display field configurations with type and value transformation",
    variables: {
      projectId: "Optional ID of the project to filter by"
    },
    query: `query GetObjectDisplayFieldsTransformed($projectId: String) {
  objectDisplayFieldsTransformed(project_id: $projectId) {
    id
    type
    value
  }
}`
  }
}; 