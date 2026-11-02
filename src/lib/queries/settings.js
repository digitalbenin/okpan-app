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
    turn_secret
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
  setSignalingServer: {
    type: "mutation",
    name: "Set Project Signaling Server",
    description: "Creates or updates only the custom signaling relay URL for a project, leaving the other settings fields untouched",
    variables: {
      projectId: "ID of the project",
      sigServer: "Signaling relay URL (ws:// or wss://), or null to use the default network"
    },
    mutations: [
      {
        name: "getSignalingSettings",
        query: `query GetSignalingSettings($projectId: String!) {
  result: settings(where: { project_id: { eq: $projectId } }) {
    id
    sig_server
  }
}`,
        useVariables: ["projectId"]
      },
      {
        name: "updateSignalingSettings",
        query: `mutation UpdateSignalingSettings($projectId: String!, $sigServer: String) {
  updateSettings(
    set: { sig_server: $sigServer }
    where: { project_id: { eq: $projectId } }
  ) {
    id
    project_id
    sig_server
  }
}`,
        useVariables: ["projectId", "sigServer"],
        mapVariables: {
          settingsId: { from: "getSignalingSettings", path: "result.0.id", skipIfUndefined: true }
        },
        skipIf: { variableName: "settingsId", isUndefined: true }
      },
      {
        name: "insertSignalingSettings",
        query: `mutation InsertSignalingSettings($projectId: String!, $sigServer: String) {
  insertIntoSettings(
    values: [{ project_id: $projectId, sig_server: $sigServer }]
  ) {
    id
    project_id
    sig_server
  }
}`,
        useVariables: ["projectId", "sigServer"],
        mapVariables: {
          existingId: { from: "getSignalingSettings", path: "result.0.id", skipIfUndefined: true }
        },
        skipIf: { variableName: "existingId", isUndefined: false }
      }
    ]
  },
  setTurnSecret: {
    type: "mutation",
    name: "Set Project TURN Secret",
    description: "Creates or updates only the TURN shared secret for a project, leaving the other settings fields untouched",
    variables: {
      projectId: "ID of the project",
      turnSecret: "TURN shared secret (TURN_SECRET of the TURN server), or null when not configured"
    },
    mutations: [
      {
        name: "getTurnSecretSettings",
        query: `query GetTurnSecretSettings($projectId: String!) {
  result: settings(where: { project_id: { eq: $projectId } }) {
    id
    turn_secret
  }
}`,
        useVariables: ["projectId"]
      },
      {
        name: "updateTurnSecretSettings",
        query: `mutation UpdateTurnSecretSettings($projectId: String!, $turnSecret: String) {
  updateSettings(
    set: { turn_secret: $turnSecret }
    where: { project_id: { eq: $projectId } }
  ) {
    id
    project_id
    turn_secret
  }
}`,
        useVariables: ["projectId", "turnSecret"],
        mapVariables: {
          settingsId: { from: "getTurnSecretSettings", path: "result.0.id", skipIfUndefined: true }
        },
        skipIf: { variableName: "settingsId", isUndefined: true }
      },
      {
        name: "insertTurnSecretSettings",
        query: `mutation InsertTurnSecretSettings($projectId: String!, $turnSecret: String) {
  insertIntoSettings(
    values: [{ project_id: $projectId, turn_secret: $turnSecret }]
  ) {
    id
    project_id
    turn_secret
  }
}`,
        useVariables: ["projectId", "turnSecret"],
        mapVariables: {
          existingId: { from: "getTurnSecretSettings", path: "result.0.id", skipIfUndefined: true }
        },
        skipIf: { variableName: "existingId", isUndefined: false }
      }
    ]
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