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
                type: "query",
                name: "List Projects",
                description: "Retrieves all projects with their institutions",
                query: `{
  project {
    id
    title
    description
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
                type: "mutation",
                name: "Create Institution",
                description: "Creates a new institution linked to a project",
                requiresProjectId: true,
                query: `mutation AddInstitution($projectId: Int!) {
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