export const INTROSPECTION_QUERY = `{
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
}`;

export const ADD_PROJECT_MUTATION = `mutation {
  insertIntoProject(values: [{
    title: "Project ${Math.random().toString(36).substring(7)}",
    description: "Description of the project"
  }]) {
    id
    title
    description
  }
}`;

export const LIST_PROJECTS_QUERY = `{
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
}`;

export const ADD_INSTITUTION_MUTATION = `mutation AddInstitution($projectId: Int!) {
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
}`;

export const LIST_INSTITUTIONS_QUERY = `{
  institutions {
    id
    name
    description
    project_id
    country
    location
  }
}`; 