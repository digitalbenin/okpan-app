
/**
 * Converts an epoch timestamp (milliseconds) or a valid date string to a DD/MM/YYYY string, optionally including time.
 * @param {number | string | Date | null | undefined} input The epoch timestamp or date string.
 * @param {boolean} [time=false] Whether to include HH:MM:SS.
 * @returns {string} The formatted date string or empty string if input is invalid.
 */
const epochToDate = (input, time = false) => {
    if (input === null || input === undefined || input === "") return '';

    let d; // Declare d here
    try {
        // Check if input looks like an ISO string (contains T and -)
        if (typeof input === 'string' && input.includes('T') && input.includes('-')) {
            d = new Date(input);
        } else {
            // Otherwise, assume it's an epoch timestamp (string or number)
            let timestamp;
            if (typeof input === 'string') {
                timestamp = parseInt(input, 10);
            } else if (typeof input === 'number') {
                timestamp = input;
            } else if (input instanceof Date) {
                timestamp = input.getTime();
            } else {
                console.warn(`Invalid input type for epochToDate: ${typeof input}`);
                return '';
            }

            if (isNaN(timestamp)) {
                console.warn(`Could not parse input to valid timestamp: ${input}`);
                return '';
            }
            d = new Date(timestamp);
        }

        // Check if the resulting date object is valid
        if (isNaN(d.getTime())) {
            console.warn(`Created invalid Date object from input: ${input}`);
            return '';
        }

    } catch (error) {
        console.error(`Error creating Date object in epochToDate: ${error}, input: ${input}`);
        return '';
    }

    // Use UTC methods
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0'); // UTC months are 0-indexed
    const year = d.getUTCFullYear();

    if (time) {
        const hours = d.getUTCHours().toString().padStart(2, '0');
        const minutes = d.getUTCMinutes().toString().padStart(2, '0');
        const seconds = d.getUTCSeconds().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }

    return `${day}/${month}/${year}`;
};

/**
 * Converts an epoch timestamp (milliseconds) or a valid date string to a YYYY-MM-DD string.
 * @param {number | string | Date | null | undefined} input The epoch timestamp or date string.
 * @returns {string} The formatted date string or empty string if input is invalid.
 */
function epochToYYYYMMDD(epoch) {
    if (epoch === null || epoch === undefined || epoch === "") {
        return "";
    }

    let timestamp;
    // Check if epoch is a string and needs parsing, or already a number
    if (typeof epoch === 'string') {
        timestamp = parseInt(epoch, 10);
    } else if (typeof epoch === 'number') {
        timestamp = epoch;
    } else {
        console.warn(`Invalid epoch type: ${typeof epoch}, value: ${epoch}`);
        return "";
    }

    // Check if parsing resulted in a valid number
    if (isNaN(timestamp)) {
        console.warn(`Could not parse epoch string to number: ${epoch}`);
        return "";
    }

    // Basic check: Is it likely seconds (e.g., < 3 billion) or milliseconds?
    // Convert seconds to milliseconds if necessary. Adjust threshold as needed.
    if (timestamp > 0 && timestamp < 3000000000) { // Assuming timestamps below 3 billion are seconds
        timestamp *= 1000;
    }

    try {
        const date = new Date(timestamp);
        // Check if the date object is valid
        if (isNaN(date.getTime())) {
            console.warn(`Invalid Date created from timestamp: ${timestamp} (original epoch: ${epoch})`);
            return "";
        }

        // Use UTC methods to avoid local timezone issues
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // UTC months are 0-indexed
        const day = String(date.getUTCDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error(`Error converting epoch ${epoch} (timestamp ${timestamp}) to YYYY-MM-DD:`, error);
        return "";
    }
}

/**
 * Formats a date-like value using the provided locale.
 * @param {number | string | Date} date The date value to format.
 * @param {string} [locale="en"] Locale passed to toLocaleDateString.
 * @param {boolean} [showTime=false] Whether to include UTC time fields.
 * @returns {string} The localized date string.
 */
function formatDate(date, locale = "en", showTime = false) {
    const options = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    };
    if (showTime) {
        options.hour = "2-digit";
        options.minute = "2-digit";
        options.second = "2-digit";
        options.hour12 = false;
        options.timeZone = "UTC";
    }
    return new Date(date).toLocaleDateString(locale, options);
}

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

function normalizeTimestamp(value) {
    if (typeof value !== "string") {
        return value;
    }

    const trimmedValue = value.trim();

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmedValue)) {
        return `${trimmedValue.replace(" ", "T")}Z`;
    }

    return value;
}

/**
 * Returns a human-readable relative time string (e.g. "2 days ago").
 * @param {number|string|Date} timestamp
 * @param {string} [locale="en"]
 * @returns {string}
 */
function timeAgo(timestamp, locale = "en") {
    return dayjs(normalizeTimestamp(timestamp)).locale(locale).fromNow();
}

export { epochToDate, epochToYYYYMMDD, formatDate, normalizeTimestamp, timeAgo };

