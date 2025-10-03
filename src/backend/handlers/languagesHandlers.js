// IPC handler to provide ISO 639-1 languages using countries-list
// Returns languages in their native form
import { languages as countriesLanguages } from 'countries-list';

/**
 * Returns an array of { code, name } for ISO 639-1 languages
 * @param {Object} event - IPC event
 * @param {Object} options - { lang?: string }
 */
export async function handleListLanguages(event, options = {}) {
  try {
    const result = Object.entries(countriesLanguages).map(([code, info]) => ({
      code,
      // Preserve legacy "name" field but fill with native form
      name: info.native || info.name,
      native: info.native || info.name,
      englishName: info.name,
      rtl: !!info.rtl
    }));
    return { success: true, result };
  } catch (err) {
    console.error('Error retrieving languages:', err);
    return { success: false, error: err?.message || 'Failed to retrieve languages' };
  }
}