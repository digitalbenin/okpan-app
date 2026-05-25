import { executeQuery } from "$lib/api/graphqlClient.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { invalidate } from "$app/navigation";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getWebsiteSettings = async (projectId) => {
    if (!projectId) {
        return { error: "Project ID is required" };
    }

    const response = await executeQuery('websiteSettings', 'getByProjectId', { projectId });
    return response;
};

export const createWebsiteSettings = async (data) => {
    // Validate the data
    const websiteSettingsSchema = getSchema('websiteSettings', 'insert');
    if (websiteSettingsSchema) {
        const validation = await validate(data, websiteSettingsSchema);
        if (!validation.success) {
            return { error: validation.errors?.[0] || 'Validation failed' };
        }
    }
    // Handle logo upload for generic assets and resolve logoId
    let logoId = undefined;
    console.log('[WebsiteSettings:create]', 'input.logoFile', data?.logoFile);
    try {
        if (data?.logoFile?.__cleared) {
            // Explicitly remove logo link
            logoId = null;
            console.log('[WebsiteSettings:create]', 'logo cleared -> logoId = null');
        } else if (data?.logoFile) {
            // If logo is already a saved asset-like object
            if (typeof data.logoFile === 'object' && data.logoFile.id) {
                logoId = data.logoFile.id;
                console.log('[WebsiteSettings:create]', 'using existing asset id', logoId);
            } else if (typeof window !== 'undefined' && window?.api?.importAssets) {
                const filePath = (typeof data.logoFile === 'string')
                    ? data.logoFile
                    : (data.logoFile?.path || data.logoFile?.filepath || data.logoFile?.filePath);
                if (filePath && (data.projectId || data.project_id)) {
                    console.log('[WebsiteSettings:create]', 'importing logo', { filePath, projectId: data.projectId || data.project_id });
                    const importResult = await window.api.importAssets({
                        path: filePath,
                        projectId: data.projectId || data.project_id,
                        isGenericAsset: true,
                    });
                    const created = importResult?.createdAssets || [];
                    logoId = created?.[0]?.id || undefined;
                    console.log('[WebsiteSettings:create]', 'import createdAssets[0].id', logoId);
                }
            }
        }
    } catch (e) {
        console.error('Logo import failed:', e);
    }

    const finalParams = {
        ...data,
        // Pass null to remove, pass id to set, omit to leave unchanged
        logoId: logoId,
    };
    console.log('[WebsiteSettings:create]', 'final logoId', logoId);
    const response = await executeQuery('websiteSettings', 'create', finalParams);
    
    if (response && !response.error) {
        // Invalidate caches to reflect the change
        invalidate("app:websiteSettings");
        invalidate("custom:websiteSettings");
    }

    return response;
};

export const updateWebsiteSettings = async (data) => {
    // Validate the data
    const websiteSettingsSchema = getSchema('websiteSettings', 'update');
    if (websiteSettingsSchema) {
        const validation = await validate(data, websiteSettingsSchema);
        if (!validation.success) {
            return { error: validation.errors?.[0] || 'Validation failed' };
        }
    }
    // Handle logo upload and resolve logoId for update as well
    let logoId = undefined;
    console.log('[WebsiteSettings:update]', 'input.logoFile', data?.logoFile);
    try {
        if (data?.logoFile === null || data?.logoFile?.__cleared) {
            // Explicitly remove logo link
            logoId = null;
            console.log('[WebsiteSettings:update]', 'logo cleared -> logoId = null');
        } else if (data?.logoFile) {
            if (typeof data.logoFile === 'object' && data.logoFile.id) {
                logoId = data.logoFile.id;
                console.log('[WebsiteSettings:update]', 'using existing asset id', logoId);
            } else if (typeof window !== 'undefined' && window?.api?.importAssets) {
                const filePath = (typeof data.logoFile === 'string')
                    ? data.logoFile
                    : (data.logoFile?.path || data.logoFile?.filepath || data.logoFile?.filePath);
                if (filePath && (data.projectId || data.project_id)) {
                    console.log('[WebsiteSettings:update]', 'importing logo', { filePath, projectId: data.projectId || data.project_id });
                    const importResult = await window.api.importAssets({
                        path: filePath,
                        projectId: data.projectId || data.project_id,
                        isGenericAsset: true,
                    });
                    const created = importResult?.createdAssets || [];
                    logoId = created?.[0]?.id || undefined;
                    console.log('[WebsiteSettings:update]', 'import createdAssets[0].id', logoId);
                }
            }
        }
    } catch (e) {
        console.error('Logo import failed:', e);
    }

    const finalParams = {
        ...data,
        logoId: logoId,
    };
    console.log('[WebsiteSettings:update]', 'final logoId', logoId);
    const response = await executeQuery('websiteSettings', 'update', finalParams);
    // Refetch fresh website settings with nested translations if projectId is available
    try {
        const pid = data?.projectId || data?.project_id;
        if (response && !response.error && pid) {
            const fresh = await getWebsiteSettings(pid);
            if (fresh && !fresh.error) {
                response.websiteSettings = fresh?.websiteSettings || response.websiteSettings;
            }
        }
    } catch (e) {
        // suppress debug warnings
    }
    
    if (response && !response.error) {
        // Invalidate caches to reflect the change
        invalidate("app:websiteSettings");
        invalidate("custom:websiteSettings");
    }

    return response;
};

export const deleteWebsiteSettings = async (id) => {
    if (!id) {
        return { error: "Website settings ID is required" };
    }

    const response = await executeQuery('websiteSettings', 'delete', { id });
    
    if (response && !response.error) {
        // Invalidate caches to reflect the change
        invalidate("app:websiteSettings");
        invalidate("custom:websiteSettings");
    }

    return response;
};