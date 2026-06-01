import { listInterfaceLanguages } from "$lib/api/InterfaceLanguagesApi.js";
import { listInterfaceTranslations } from "$lib/api/InterfaceTranslationsApi.js";

export const csr = true;
export const prerender = false;
export const ssr = false;

export async function load({ depends }) {
    depends('app:interface');

    const [languages, translations] = await Promise.all([
        listInterfaceLanguages(),
        listInterfaceTranslations()
    ]);

    let currentLocale = 'en';
    try {
        const settings = await window.api.getGlobalSettings();
        const persistedLocale = typeof settings?.interfaceLanguage === 'string'
            ? settings.interfaceLanguage.trim()
            : '';
        if (persistedLocale && languages?.some(lang => lang.code === persistedLocale)) {
            currentLocale = persistedLocale;
        } else if (languages?.some(lang => lang.code === 'en')) {
            currentLocale = 'en';
        } else if (languages?.length > 0) {
            currentLocale = languages[0].code;
        }
    } catch {
        // Fall back to default locale
    }

    return {
        interfaceLanguages: languages || [],
        interfaceTranslations: translations || [],
        interfaceLocale: currentLocale
    };
}
