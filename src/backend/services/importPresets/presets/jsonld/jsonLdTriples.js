import { appendValue, buildPrefilledMapping, finalizeRow } from '../../shared/presetUtils.js';

// Returns true if data looks like JSON-LD — checks recursively for @context, @id, @type, or @graph at any level
export const isJsonLdShape = (data) => {
  if (Array.isArray(data)) return data.some(isJsonLdShape);
  if (!data || typeof data !== 'object') return false;
  return ['@context', '@id', '@type', '@graph'].some((k) => k in data);
};

// Unwrap @graph/@set wrappers and bare arrays to get the list of entity objects
const extractEntityCollection = (data) => {
  if (Array.isArray(data)) return data.filter((v) => v && typeof v === 'object' && !('@value' in v));
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data['@graph'])) return data['@graph'].filter((v) => v && typeof v === 'object');
  if (Array.isArray(data['@set'])) return data['@set'].filter((v) => v && typeof v === 'object');
  return [data];
};

// Reduce a JSON-LD value to flat string(s); returns [] for objects that need dot-path expansion
const toStrings = (value) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(toStrings);
  if (typeof value !== 'object') return [String(value)];
  if ('@value' in value) return value['@value'] != null ? [String(value['@value'])] : [];
  if ('@set' in value) return toStrings(value['@set']);
  if ('@list' in value) return toStrings(value['@list']);
  if ('@id' in value) return [String(value['@id'])];
  return [];
};

// When expanding an array of objects, find a property whose values are unique single
// strings across all items — it can serve as a key selector instead of a flat merge.
const findKeyProperty = (items) => {
  if (items.length < 2) return null;
  const allProps = items.map((item) =>
    Object.keys(item).filter((k) => k !== '@context' && !k.startsWith('@'))
  );
  const commonProps = allProps[0].filter((p) => allProps.every((props) => props.includes(p)));
  for (const prop of commonProps) {
    const vals = items.map((item) => toStrings(item[prop]));
    if (!vals.every((v) => v.length === 1)) continue;
    if (new Set(vals.map((v) => v[0])).size === vals.length) return prop;
  }
  return null;
};

// Projects a single JSON-LD entity into a flat key→value row.
// Scalar predicates are stored directly; object-valued predicates are dot-path expanded,
// using keyed expansion (predicate[keyProp=val].subKey) when a stable key property is found,
// or flat expansion (predicate.subKey) otherwise.
const projectEntity = (entity) => {
  const row = {};

  for (const [key, rawValue] of Object.entries(entity)) {
    if (key === '@context') continue;

    if (key === '@id') {
      appendValue(row, '@id', String(rawValue));
      continue;
    }

    if (key === '@type') {
      (Array.isArray(rawValue) ? rawValue : [rawValue])
        .filter(Boolean)
        .forEach((t) => appendValue(row, '@type', String(t)));
      continue;
    }

    const strings = toStrings(rawValue);
    if (strings.length) {
      strings.forEach((s) => appendValue(row, key, s));
    } else {
      const items = (Array.isArray(rawValue) ? rawValue : [rawValue])
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item));
      if (!items.length) continue;

      const keyProp = findKeyProperty(items);
      if (keyProp) {
        // Keyed expansion: predicate[keyProp=keyVal].otherProp
        for (const item of items) {
          const keyVal = toStrings(item[keyProp])[0];
          const selector = `${key}[${keyProp}=${keyVal}]`;
          for (const [subKey, subVal] of Object.entries(item)) {
            if (subKey === '@context' || subKey === '@type' || subKey === keyProp) continue;
            toStrings(subVal).forEach((s) => appendValue(row, `${selector}.${subKey}`, s));
          }
        }
      } else {
        // Flat dot-path expansion
        for (const item of items) {
          for (const [subKey, subVal] of Object.entries(item)) {
            if (subKey === '@context' || subKey === '@type') continue;
            toStrings(subVal).forEach((s) => appendValue(row, `${key}.${subKey}`, s));
          }
        }
      }
    }
  }

  return finalizeRow(row);
};

// Entry point: collects all entity objects from data, projects each to a flat row, and returns rows + prefilled mapping
export const extractJsonLdProjection = (data) => {
  const entities = extractEntityCollection(data);
  const rows = entities.map(projectEntity).filter((r) => Object.keys(r).length > 0);
  return { rows, prefilledMapping: buildPrefilledMapping(rows, ['@id']), warnings: [] };
};
