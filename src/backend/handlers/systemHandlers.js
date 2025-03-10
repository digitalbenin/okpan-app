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
    const dialogOptions = {
        properties: [
            options.isDirectory ? 'openDirectory' : 'openFile',
            options.multiple && !options.isDirectory ? 'multiSelections' : null
        ].filter(Boolean),
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'] },
            { name: 'Videos', extensions: ['mp4', 'webm', 'ogg'] },
            { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    };

    return await dialog.showOpenDialog(dialogOptions);
}; 