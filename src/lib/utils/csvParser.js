/**
 * Pure utility functions for parsing and validating CSV files on the frontend.
 * Used for preview/validation before sending to backend services.
 *
 * @module csv-parser
 */

/**
 * Derive a human-readable type name from a filename.
 * Strips extension and replaces underscores/hyphens with spaces.
 *
 * @param {string} fileName - The filename to process.
 * @returns {string} The suggested type name.
 */
export function getSuggestedTypeName(fileName) {
  return String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * Parse a single CSV line, handling quoted fields and escaped quotes.
 * Also strips BOM characters from values.
 *
 * @param {string} line - The CSV line to parse.
 * @returns {string[]} Array of parsed field values.
 */
export function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result.map((value) => value.replace(/^\uFEFF/, ''));
}

/**
 * Analyze CSV headers to validate structure and extract language codes.
 * Expects columns named option_<lang> and description_<lang>, plus optional
 * connection_id and external_link columns.
 *
 * @param {string} csvContent - The full CSV content as a string.
 * @returns {{valid: boolean, csvLanguages: string[]}} Analysis result.
 */
export function analyzeCsvHeaders(csvContent) {
  const firstLine = String(csvContent || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return { valid: false, csvLanguages: [] };
  }

  const columns = parseCsvLine(firstLine);
  const optionColumns = columns.filter((column) => column.startsWith('option_'));
  const descriptionColumns = columns.filter((column) => column.startsWith('description_'));
  const allowedColumns = new Set(['connection_id', 'external_link', ...optionColumns, ...descriptionColumns]);
  const hasUnexpectedColumns = columns.some((column) => !allowedColumns.has(column));

  if (optionColumns.length === 0 || hasUnexpectedColumns) {
    return { valid: false, csvLanguages: [] };
  }

  return {
    valid: true,
    csvLanguages: Array.from(new Set([
      ...optionColumns.map((column) => column.slice('option_'.length)),
      ...descriptionColumns.map((column) => column.slice('description_'.length))
    ]))
  };
}
