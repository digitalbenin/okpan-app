import { dialog } from 'electron';

/**
 * Handler for ping requests
 * @returns {string} 'pong' response
 */
export const handlePing = () => {
    console.log('pong');
    return 'pong';
};

/**
 * Handler for opening system file dialog
 * @param {Event} event - The IPC event
 * @param {Object} options - Dialog options
 * @param {boolean} options.isDirectory - Whether to open directory picker
 * @param {boolean} options.multiple - Whether to allow multiple file selection
 * @returns {Promise<Object>} Dialog result containing selected file paths
 */
export const handleFileDialog = async (event, options) => {
    // Default filters if none are provided
    const defaultFilters = [
        { name: 'All Files', extensions: ['*'] }
    ];

    const dialogOptions = {
        // Use options.title if provided, otherwise keep it default
        title: options.title || 'Select File',
        properties: [
            options.isDirectory ? 'openDirectory' : 'openFile',
            // Use options.properties if provided (like 'openFile')
            // Note: Electron combines properties, so sending ['openFile'] 
            // from renderer is okay even if we derive it here.
            ...(Array.isArray(options.properties) ? options.properties : []),
            options.multiple && !options.isDirectory ? 'multiSelections' : null
        ].filter(p => p !== null && p !== undefined).filter((v, i, a) => a.indexOf(v) === i), // Filter nulls and duplicates
        // Use filters from options if provided, otherwise use the default
        filters: options.filters && Array.isArray(options.filters) && options.filters.length > 0
            ? options.filters
            : defaultFilters
    };

    // Log the final options being used for debugging
    // console.log("Using dialog options:", JSON.stringify(dialogOptions, null, 2));

    try {
        const result = await dialog.showOpenDialog(dialogOptions);
        return result; // Return the full result object (includes canceled flag)
    } catch (error) {
        console.error("Error showing file dialog:", error);
        // Return an error structure consistent with a cancelled dialog
        return { canceled: true, filePaths: [] };
    }
}; 