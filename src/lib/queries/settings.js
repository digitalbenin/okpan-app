export const settingsOperations = {
    getByProjectId: {
        type: "query",
        name: "Get Settings by Project ID",
        description: "Retrieves settings for a specific project",
        variables: {
            projectId: "ID of the project"
        },
        query: `query GetProjectSettings($projectId: String!) {\n  result: settings(where: { project_id: { eq: $projectId } }) {\n    id\n    project_id\n    username\n    password\n    sync_url\n    sig_server\n    created_at\n    updated_at\n  }\n}`
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
        query: `mutation CreateProjectSettings($projectId: String!, $username: String, $password: String, $syncUrl: String, $sigServer: String) {\n  insertIntoSettings(values: [{\n    project_id: $projectId,\n    username: $username,\n    password: $password,\n    sync_url: $syncUrl,\n    sig_server: $sigServer\n  }]) {\n    id\n    project_id\n    username\n    password\n    sync_url\n    sig_server\n    created_at\n    updated_at\n  }\n}`
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
        query: `mutation UpdateProjectSettings(\n  $settingsId: String!, \n  $username: String, \n  $password: String, \n  $syncUrl: String, \n  $sigServer: String\n) {\n  updateSettings(\n    set: { \n      username: $username,\n      password: $password,\n      sync_url: $syncUrl,\n      sig_server: $sigServer\n    }\n    where: { id: { eq: $settingsId } }\n  ) {\n    id\n    project_id\n    username\n    password\n    sync_url\n    sig_server\n    updated_at\n  }\n}`
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
        query: `mutation UpdateProjectSettingsByProjectId(\n  $projectId: String!, \n  $username: String, \n  $password: String, \n  $syncUrl: String, \n  $sigServer: String\n) {\n  updateSettings(\n    set: { \n      username: $username,\n      password: $password,\n      sync_url: $syncUrl,\n      sig_server: $sigServer\n    }\n    where: { project_id: { eq: $projectId } }\n  ) {\n    id\n    project_id\n    username\n    password\n    sync_url\n    sig_server\n    updated_at\n  }\n}`
    },
    delete: {
        type: "mutation",
        name: "Delete Project Settings",
        description: "Deletes project settings by ID",
        variables: {
            settingsId: "ID of the settings to delete"
        },
        query: `mutation DeleteProjectSettings($settingsId: String!) {\n  deleteFromSettings(where: { id: { eq: $settingsId } }) {\n    id\n    project_id\n  }\n}`
    },
    deleteByProjectId: {
        type: "mutation",
        name: "Delete Project Settings by Project ID",
        description: "Deletes settings for a project by project ID",
        variables: {
            projectId: "ID of the project"
        },
        query: `mutation DeleteProjectSettingsByProjectId($projectId: String!) {\n  deleteFromSettings(where: { project_id: { eq: $projectId } }) {\n    id\n    project_id\n  }\n}`
    }
}; 