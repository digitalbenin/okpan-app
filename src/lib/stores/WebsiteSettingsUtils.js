import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { invalidate } from "$app/navigation";

// Get validation store
const { getSchema, validate } = getValidationStore();

function logTranslationStep(stepName, stepObj) {
    try {
        const processed = stepObj?.processedCount ?? 0;
        const errCount = Array.isArray(stepObj?.errors) ? stepObj.errors.length : 0;
        const itemCount = Array.isArray(stepObj?.translationResults) ? stepObj.translationResults.length : 0;
        console.log(`[WSU] step=${stepName} processed=${processed} items=${itemCount} errors=${errCount}`);
    } catch {}
}

function logAggregateTranslationResults(response) {
    try {
        const processed = response?.processedCount ?? 0;
        const items = Array.isArray(response?.translationResults) ? response.translationResults.length : 0;
        console.log(`[WSU] agg processed=${processed} items=${items}`);
    } catch {}
}

export const getWebsiteSettings = async (projectId) => {
    if (!projectId) {
        return { error: "Project ID is required" };
    }

    const response = await executeQuery('websiteSettings', 'getByProjectId', { projectId });
    return response;
};

export const createWebsiteSettings = async (data) => {
    console.log(
        `[WSU] create in t=${!!data?.title} a=${!!data?.about} tTr=${Array.isArray(data?.titleTranslations) ? data.titleTranslations.length : 0} aTr=${Array.isArray(data?.aboutTranslations) ? data.aboutTranslations.length : 0}`
    );
    // Validate the data
    const websiteSettingsSchema = getSchema('websiteSettings', 'insert');
    if (websiteSettingsSchema) {
        const validation = await validate(data, websiteSettingsSchema);
        if (!validation.success) {
            return { error: validation.errors?.[0] || 'Validation failed' };
        }
    }
    // Handle logo upload for generic assets and resolve logoId
    let logoId = null;
    try {
        if (data?.logoFile) {
            // If logo is already a saved asset-like object
            if (typeof data.logoFile === 'object' && data.logoFile.id) {
                logoId = data.logoFile.id;
            } else if (typeof window !== 'undefined' && window?.api?.importAssets) {
                const filePath = data.logoFile?.path || data.logoFile?.filepath || data.logoFile?.filePath;
                console.log('[WebsiteSettingsUtils] create: logo filePath:', filePath);
                if (filePath && (data.projectId || data.project_id)) {
                    const importResult = await window.api.importAssets({
                        path: filePath,
                        projectId: data.projectId || data.project_id,
                        isGenericAsset: true,
                    });
                    console.log('[WebsiteSettingsUtils] create: importAssets result:', importResult);
                    const created = importResult?.createdAssets || [];
                    logoId = created?.[0]?.id || null;
                }
            }
        }
    } catch (e) {
        console.error('Logo import failed:', e);
    }

    const finalParams = {
        ...data,
        logoId: logoId || undefined,
    };
    console.log('[WebsiteSettingsUtils] create: final params:', finalParams);
    try {
        console.log('[WebsiteSettingsUtils] create: final params translation codes', {
            titleCodes: Array.isArray(finalParams?.titleTranslations) ? finalParams.titleTranslations.map(t => t.language_code) : [],
            aboutCodes: Array.isArray(finalParams?.aboutTranslations) ? finalParams.aboutTranslations.map(t => t.language_code) : []
        });
    } catch {}
    const response = await executeQuery('websiteSettings', 'create', finalParams);
    console.log(`[WSU] create resp ok=${!(response && response.error)} err=${response?.error ? String(response.error).slice(0,120) : 'none'}`);
    try {
        logTranslationStep('processTitleTranslations', response?.processTitleTranslations);
        logTranslationStep('processAboutTranslations', response?.processAboutTranslations);
        logTranslationStep('processAboutTranslationsNew', response?.processAboutTranslationsNew);
        logAggregateTranslationResults(response);
    } catch {}
    
    if (response && !response.error) {
        // Invalidate caches to reflect the change
        invalidate("app:websiteSettings");
        invalidate("custom:websiteSettings");
    }

    return response;
};

export const updateWebsiteSettings = async (data) => {
    console.log(
        `[WSU] update in t=${!!data?.title} a=${!!data?.about} tTr=${Array.isArray(data?.titleTranslations) ? data.titleTranslations.length : 0} aTr=${Array.isArray(data?.aboutTranslations) ? data.aboutTranslations.length : 0}`
    );
    // Validate the data
    const websiteSettingsSchema = getSchema('websiteSettings', 'update');
    if (websiteSettingsSchema) {
        const validation = await validate(data, websiteSettingsSchema);
        if (!validation.success) {
            return { error: validation.errors?.[0] || 'Validation failed' };
        }
    }
    // Handle logo upload and resolve logoId for update as well
    let logoId = null;
    try {
        if (data?.logoFile) {
            if (typeof data.logoFile === 'object' && data.logoFile.id) {
                logoId = data.logoFile.id;
            } else if (typeof window !== 'undefined' && window?.api?.importAssets) {
                const filePath = data.logoFile?.path || data.logoFile?.filepath || data.logoFile?.filePath;
                console.log('[WebsiteSettingsUtils] update: logo filePath:', filePath);
                if (filePath && (data.projectId || data.project_id)) {
                    const importResult = await window.api.importAssets({
                        path: filePath,
                        projectId: data.projectId || data.project_id,
                        isGenericAsset: true,
                    });
                    console.log('[WebsiteSettingsUtils] update: importAssets result:', importResult);
                    const created = importResult?.createdAssets || [];
                    logoId = created?.[0]?.id || null;
                }
            }
        }
    } catch (e) {
        console.error('Logo import failed:', e);
    }

    const finalParams = {
        ...data,
        logoId: logoId || undefined,
    };
    console.log(
        `[WSU] update params logoId=${finalParams.logoId || 'none'} tTr=${Array.isArray(finalParams?.titleTranslations) ? finalParams.titleTranslations.length : 0} aTr=${Array.isArray(finalParams?.aboutTranslations) ? finalParams.aboutTranslations.length : 0}`
    );
    const response = await executeQuery('websiteSettings', 'update', finalParams);
    console.log(`[WSU] update resp ok=${!(response && response.error)} err=${response?.error ? String(response.error).slice(0,120) : 'none'}`);
    try {
        logTranslationStep('processTitleTranslations', response?.processTitleTranslations);
        logTranslationStep('processTitleTranslationsNew', response?.processTitleTranslationsNew);
        logTranslationStep('processAboutTranslations', response?.processAboutTranslations);
        logTranslationStep('processAboutTranslationsNew', response?.processAboutTranslationsNew);
        logAggregateTranslationResults(response);
    } catch {}
    // Refetch fresh website settings with nested translations if projectId is available
    try {
        const pid = data?.projectId || data?.project_id;
        if (response && !response.error && pid) {
            const fresh = await getWebsiteSettings(pid);
            console.log('[WebsiteSettingsUtils] update: refetched websiteSettings:', fresh);
            if (fresh && !fresh.error) {
                response.websiteSettings = fresh?.websiteSettings || response.websiteSettings;
            }
        }
    } catch (e) {
        console.warn('[WebsiteSettingsUtils] update: refetch failed', e);
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