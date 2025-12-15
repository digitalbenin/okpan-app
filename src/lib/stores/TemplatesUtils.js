import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";

export const getTemplatesByInstitution = async (institutionId) => {
  if (!institutionId) {
    throw new Error("Institution ID is required to fetch templates");
  }
  return await executeQuery("templates", "getByInstitution", { institutionId });
};

export const createTemplate = async ({ mapping, projectId, institutionId, title }) => {
  if (!projectId) {
    throw new Error("Project ID is required to create a template");
  }
  if (!mapping) {
    throw new Error("Template mapping is required");
  }

  const variables = {
    name: title,
    mapping,
    projectId,
    institutionId,
  };

  const result = await executeQuery("templates", "create", variables);
  invalidate("app:templates");
  return result;
};

export const updateTemplate = async (templateId, { mapping, institutionId, title }) => {
  if (!templateId) {
    throw new Error("Template ID is required to update a template");
  }

  const variables = {
    templateId,
    name: title,
    mapping,
    institutionId,
  };

  const result = await executeQuery("templates", "update", variables);
  invalidate("app:templates");
  return result;
};

export const deleteTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error("Template ID is required to delete a template");
  }
  const result = await executeQuery("templates", "delete", { templateId });
  invalidate("app:templates");
  return result;
};
