import { executeQuery } from "$lib/api/graphqlClient.js";
import { invalidate } from "$app/navigation";

/**
 * @namespace frontend.api.InterfaceLanguagesApi
 */

export const listInterfaceLanguages = async () => {
    return executeQuery('interface_languages', 'list');
};

export const createInterfaceLanguage = async (variables) => {
    const result = await executeQuery('interface_languages', 'create', variables);
    await invalidate('app:interface');
    return result;
};

export const deleteInterfaceLanguage = async (variables) => {
    const result = await executeQuery('interface_languages', 'delete', variables);
    await invalidate('app:interface');
    return result;
};
