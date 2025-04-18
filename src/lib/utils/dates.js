/**
 * Converts an epoch timestamp (milliseconds) or a valid date string to a DD/MM/YYYY string, optionally including time.
 * @param {number | string | Date | null | undefined} input The epoch timestamp or date string.
 * @param {boolean} [time=false] Whether to include HH:MM:SS.
 * @returns {string} The formatted date string or empty string if input is invalid.
 */
const epochToDate = (input, time = false) => {
    if (input === null || input === undefined) return '';
    // Try creating a Date object directly - works for epoch numbers, date strings, Date objects
    const d = new Date(input);
    // Check if the resulting date is valid
    if (isNaN(d.getTime())) return '';

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    if (time) {
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const seconds = d.getSeconds().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }

    return `${day}/${month}/${year}`;
};

/**
 * Converts an epoch timestamp (milliseconds) or a valid date string to a YYYY-MM-DD string.
 * @param {number | string | Date | null | undefined} input The epoch timestamp or date string.
 * @returns {string} The formatted date string or empty string if input is invalid.
 */
const epochToYYYYMMDD = (input) => {
    if (input === null || input === undefined || input === '') return '';
    try {
        // Try creating a Date object directly - works for epoch numbers, date strings, Date objects
        const d = new Date(input);
        // Check if the resulting date is valid
        if (isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        // This catch might be less necessary now, but can stay as a fallback
        console.error("Error formatting date:", input, e);
        return '';
    }
};

export { epochToDate, epochToYYYYMMDD };

