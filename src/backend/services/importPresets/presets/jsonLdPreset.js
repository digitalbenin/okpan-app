const uniqueStrings = (values) => {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim() !== '').map(String))];
};

const joinValues = (values) => uniqueStrings(values).join('|');

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

const appendValue = (target, key, value) => {
  if (!key) return;
  if (value === undefined || value === null || value === '') return;

  if (!target[key]) {
    target[key] = [];
  }

  target[key].push(value);
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

const finalizeRow = (bucketRow) => {
  const row = {};

  Object.entries(bucketRow).forEach(([key, values]) => {
    if (!Array.isArray(values) || !values.length) {
      row[key] = null;
      return;
    }

    row[key] = joinValues(values);
  });

  return row;
};

const buildPrefilledMapping = (rows) => {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!headers.length) return [];

  const primaryHeader = headers.includes('definition') ? 'definition' : headers[0];

  return headers.map((header) => ({
    headerField: header,
    mappedField: null,
    primary: header === primaryHeader ? 1 : 0
  }));
};

const jsonLdPreset = {
  id: 'json-ld',
  label: 'JSON-LD',
  description: 'Parses any JSON-LD document into flat import rows without schema assumptions.',
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

    return {
      data: rows,
      tabularized: true,
      prefilledMapping: buildPrefilledMapping(rows),
      warnings: ['Labels-only projection applied: kept _label values by parent key and dropped ids.']
    };
  }
};

export default jsonLdPreset;
