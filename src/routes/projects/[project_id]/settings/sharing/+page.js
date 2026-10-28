import { getProjectConnectionSettings } from "$lib/api/SettingsApi.js";

export const load = async ({ parent }) => {
  const parentData = await parent();
  const connection = await getProjectConnectionSettings(parentData.project.id);
  return {
    project: parentData.project,
    signalingServer: connection.signalingServer,
    turnSecret: connection.turnSecret
  };
};
