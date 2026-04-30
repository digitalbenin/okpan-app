import {
  appendValue,
  buildPrefilledMapping,
  finalizeRow
} from '../shared/presetUtils.js';

const FIELD_HINTS = [
  { match: /(^|\.)title$/i, mappedFieldName: 'title' },
  { match: /(^|\.)name$/i, mappedFieldName: 'title' },
  { match: /(^|\.)description$/i, mappedFieldName: 'description' },
  { match: /(^|\.)identifier$/i, mappedFieldName: 'identifier' },
  { match: /(^|\.)date$/i, mappedFieldName: 'date' }
];

const isJsonLdShape = (data) => {
  if (!data) return false;

  if (Array.isArray(data)) {
    return data.some((entry) => isJsonLdShape(entry));
  }

  if (typeof data !== 'object') return false;

  if ('@context' in data || '@id' in data || '@type' in data || '@graph' in data) {
    return true;
  }

  return false;
};

const extractNodes = (data) => {
  if (Array.isArray(data)) {
    return data.filter((entry) => entry && typeof entry === 'object');
  }

  if (!data || typeof data !== 'object') return [];

  if (Array.isArray(data['@graph'])) {
    return data['@graph'].filter((entry) => entry && typeof entry === 'object');
  }

  return [data];
};

const collectLabels = (value, parentKey = null, target = {}) => {
  if (value === null || value === undefined) {
    return target;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectLabels(entry, parentKey, target);
    });
    return target;
  }

  if (typeof value !== 'object') {
    return target;
  }

  const hasLabel = typeof value._label === 'string' && value._label.trim() !== '';
  const hasContent = Object.prototype.hasOwnProperty.call(value, 'content');

  if (hasLabel && hasContent) {
    appendValue(target, value._label.trim(), value.content);
  }

  Object.entries(value).forEach(([key, childValue]) => {
    if (key === '@context' || key === 'id' || key === '@id') {
      return;
    }

    if (key === 'content' && hasLabel) {
      return;
    }

    if (key === '_label') {
      const labelKey = parentKey || 'definition';
      appendValue(target, labelKey, childValue);
      return;
    }

    collectLabels(childValue, key, target);
  });

  return target;
};

function getMappedFieldName(headerField) {
  return FIELD_HINTS.find((hint) => hint.match.test(headerField))?.mappedFieldName || null;
}

const jsonLdPreset = {
  id: 'json-ld',
  label: 'JSON-LD',
  description: 'Projects JSON-LD labels into flat import rows with lightweight mapping hints.',
  supportedFormats: ['json'],

  canAutoDetect({ format, data }) {
    if (format !== 'json') return false;
    return isJsonLdShape(data);
  },

  parse({ data }) {
    const nodes = extractNodes(data);

    if (!nodes.length) {
      return {
        data: [],
        tabularized: true,
        prefilledMapping: [],
        warnings: ['No JSON-LD nodes were found in the file.']
      };
    }

    const rows = nodes
      .map((node) => finalizeRow(collectLabels(node, null, {})))
      .filter((row) => Object.keys(row).length > 0);

    const prefilledMapping = buildPrefilledMapping(rows, ['definition']).map((entry) => ({
      ...entry,
      mappedFieldName: getMappedFieldName(entry.headerField)
    }));

    return {
      data: rows,
      tabularized: true,
      prefilledMapping,
      warnings: ['JSON-LD parser applied: labels were flattened into importable fields.']
    };
  }
};

export default jsonLdPreset;