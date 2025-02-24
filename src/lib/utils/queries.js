export const API_SECTIONS = {
  projects: {
    name: "Projects",
    operations: [
      {
        type: "mutation",
        name: "Create Project",
        description: "Creates a new project with auto-generated title",
        query: `mutation {
  insertIntoProject(values: [{
    title: "Project ${Math.random().toString(36).substring(7)}",
    description: "Description of the project"
  }]) {
    id
    title
    description
  }
}`
      },
      {
        type: "mutation",
        name: "Update Project",
        description: "Updates an existing project by ID",
        requiresProjectId: true,
        query: `mutation UpdateProject($projectId: String!) {
  updateProject(
    set: {
      title: "Updated Project Title",
      description: "Updated project description"
    }
    where: { id: { eq: $projectId } }
  ) {
    id
    title
    description
  }
}`
      },
      {
        type: "mutation",
        name: "Delete Project",
        description: "Deletes a project by ID",
        requiresProjectId: true,
        query: `mutation DeleteProject($projectId: String!) {
  deleteFromProject(
    where: { id: { eq: $projectId } }
  ) {
    id
    title
    description
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
    title
    description
    institutionsCount
    institutions {
      id
      name
      description
      country
      location
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
        requiresProjectId: true,
        query: `query GetInstitution($projectId: String!) {
  institutions(where: { id: { eq: $projectId } }) {
    id,
    created_at
    updated_at
    name
    description
    project {
      id
      title
      description
    }
    country
    location
  }
}`
      },
      {
        type: "mutation",
        name: "Create Institution",
        description: "Creates a new institution linked to a project",
        requiresProjectId: true,
        query: `mutation AddInstitution($projectId: String!) {
  insertIntoInstitutions(values: [{
    name: "Institution ${Math.random().toString(36).substring(7)}",
    description: "Description of the institution",
    project_id: $projectId,
    country: "Test Country",
    location: "Test Location"
  }]) {
    id
    name
    description
    project_id
  }
}`
      },
      {
        type: "query",
        name: "List Institutions",
        description: "Retrieves all institutions",
        query: `{
  institutions {
    id
    name
    description
    project {
      id
      title
      description
    }
    country
    location
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