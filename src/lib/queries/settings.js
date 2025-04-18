export const settingsOperations = {
    getByProjectId: {
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
    create: {
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
        query: `mutation CreateProjectSettings(
  $projectId: String!
  $username: String
  $password: String
  $syncUrl: String
  $sigServer: String
) {
  insertIntoSettings(
    values: [
      {
        project_id: $projectId
        username: $username
        password: $password
        sync_url: $syncUrl
        sig_server: $sigServer
      }
    ]
  ) {
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
    update: {
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
  $settingsId: String!
  $username: String
  $password: String
  $syncUrl: String
  $sigServer: String
) {
  updateSettings(
    set: { username: $username, password: $password, sync_url: $syncUrl, sig_server: $sigServer }
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
    updateByProjectId: {
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
  $projectId: String!
  $username: String
  $password: String
  $syncUrl: String
  $sigServer: String
) {
  updateSettings(
    set: { username: $username, password: $password, sync_url: $syncUrl, sig_server: $sigServer }
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
    delete: {
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
    deleteByProjectId: {
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
}; 