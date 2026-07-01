/**
 * Connection type color utilities for the website.
 * Maps templateId from research_field.fields_config to border and text colors.
 */

const TEMPLATE_COLORS = {
	custom: { border: '#0DCAF0', text: '#087990' },
	indigenous_designation: { border: '#D3A621', text: '#7F6414' },
	iconography: { border: '#1470CC', text: '#0C437A' },
	place: { border: '#2D2DB2', text: '#1A1A7A' },
	oral_history: { border: '#FD7E14', text: '#984C0C' },
	people: { border: '#008060', text: '#004D3A' }
};

const DEFAULT_COLORS = { border: '#A2A39D', text: '#51524E' };

/**
 * Parse a field's fields_config and extract connection colors.
 * @param {Object|string|null|undefined} fieldsConfig - The fields_config from a research_field
 * @returns {{ border: string, text: string }}
 */
export function getConnectionColorsFromConfig(fieldsConfig) {
	if (!fieldsConfig) return DEFAULT_COLORS;
	let config = fieldsConfig;
	if (typeof config === 'string') {
		try { config = JSON.parse(config); } catch { return DEFAULT_COLORS; }
	}
	const templateId = config?.templateId;
	return TEMPLATE_COLORS[templateId] || DEFAULT_COLORS;
}

/**
 * Get the border color for a connection type from its fields_config.
 * @param {Object|string|null|undefined} fieldsConfig
 * @returns {string}
 */
export function getConnectionBorderColor(fieldsConfig) {
	return getConnectionColorsFromConfig(fieldsConfig).border;
}

/**
 * Get the text color for a connection type from its fields_config.
 * @param {Object|string|null|undefined} fieldsConfig
 * @returns {string}
 */
export function getConnectionTextColor(fieldsConfig) {
	return getConnectionColorsFromConfig(fieldsConfig).text;
}
