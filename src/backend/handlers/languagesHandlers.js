/**
 * IPC handlers for language metadata.
 * @namespace backend.handlers.languagesHandlers
 * @memberof backend.handlers
 */
import { languages as countriesLanguages } from 'countries-list';

/**
 * Return ISO 639-1 language metadata in native form.
 * @memberof backend.handlers.languagesHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Handler options.
 * @returns {Promise<Object>} Result object with `success`, `result`, or `error`.
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