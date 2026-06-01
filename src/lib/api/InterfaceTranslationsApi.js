import { executeQuery } from "$lib/api/graphqlClient.js";
import { invalidate } from "$app/navigation";

/**
 * @namespace frontend.api.InterfaceTranslationsApi
 */

export const listInterfaceTranslations = async () => {
    return executeQuery('interface_translations', 'list');
};

export const getInterfaceTranslationsByLocale = async (variables) => {
    return executeQuery('interface_translations', 'getByLocale', variables);
};

export const createInterfaceTranslation = async (variables) => {
    const result = await executeQuery('interface_translations', 'create', variables);
    await invalidate('app:interface');
    return result;
};

export const updateInterfaceTranslation = async (variables) => {
    const result = await executeQuery('interface_translations', 'update', variables);
    await invalidate('app:interface');
    return result;
};

export const deleteInterfaceTranslation = async (variables) => {
    const result = await executeQuery('interface_translations', 'delete', variables);
    await invalidate('app:interface');
    return result;
};

export const importInterfaceTranslations = async (variables) => {
    const result = await executeQuery('interface_translations', 'import', variables);
    await invalidate('app:interface');
    return result;
};
