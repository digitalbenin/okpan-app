export const normalizeStrings = (values) => {
  const source = Array.isArray(values) ? values.flat(Infinity) : [values];

  return source
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
    .map((value) => String(value).trim());
};

export const uniqueStrings = (values) => [...new Set(normalizeStrings(values))];

export const appendValue = (target, key, value) => {
  if (!key) return;

  const values = Array.isArray(value) ? value.flat(Infinity) : [value];
  const normalizedValues = values.filter(
    (entry) => entry !== undefined && entry !== null && String(entry).trim() !== ''
  );

  if (!normalizedValues.length) return;

  if (!target[key]) {
    target[key] = [];
  }

  target[key].push(...normalizedValues);
};

export const finalizeRow = (bucketRow) => {
  const row = {};

  Object.entries(bucketRow).forEach(([key, values]) => {
    const normalizedValues = normalizeStrings(values);
    if (!normalizedValues.length) return;
    row[key] = normalizedValues.length === 1 ? normalizedValues[0] : normalizedValues;
  });

  return row;
};

export const buildPrefilledMapping = (rows, primaryHeaderCandidates = []) => {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!headers.length) return [];

  const primaryHeader = primaryHeaderCandidates.find((candidate) => headers.includes(candidate))
    || headers[0];

  return headers.map((header) => ({
    headerField: header,
    mappedField: null,
    primary: header === primaryHeader ? 1 : 0
  }));
};