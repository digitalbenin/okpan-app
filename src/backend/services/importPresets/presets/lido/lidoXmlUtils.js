import { uniqueStrings } from '../../shared/presetUtils.js';

const TEXT_NODE_KEYS = new Set(['#text', '__text', '#cdata', '__cdata', '#cdata-section', 'text']);

// Wraps any value in an array; returns [] for null/undefined.
export const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

// Strips an XML namespace prefix from a key (e.g. `lido:objectWorkType` → `objectWorkType`).
export const getLocalName = (key) => {
  if (typeof key !== 'string') return '';
  return key.includes(':') ? key.split(':').pop() : key;
};

// Returns true for keys that carry raw XML text content (#text, __text, etc.).
export const isTextNodeKey = (key) => TEXT_NODE_KEYS.has(key);

// Lowercases and trims a value for case-insensitive pattern matching.
export const normalizeText = (value) => String(value || '').trim().toLowerCase();

// Reads an XML attribute value from a parsed node (handles both @_name and @name prefixes).
export const getAttribute = (node, name) => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return '';
  return node[`@_${name}`] ?? node[`@${name}`] ?? '';
};

const getSortValue = (node) => {
  const sortorder = Number(getAttribute(node, 'sortorder'));
  return Number.isFinite(sortorder) ? sortorder : Number.MAX_SAFE_INTEGER;
};

const getPreferenceRank = (node) => {
  const pref = normalizeText(getAttribute(node, 'pref'));
  return pref === 'preferred' || pref === 'pref' ? 0 : 1;
};

// Sorts an array of LIDO nodes by their `pref` attribute (preferred first),
// then by numeric `sortorder` attribute ascending.
export const sortNodes = (nodes) => [...toArray(nodes)].sort((left, right) => {
  const preferenceDelta = getPreferenceRank(left) - getPreferenceRank(right);
  if (preferenceDelta !== 0) return preferenceDelta;
  return getSortValue(left) - getSortValue(right);
});

// Returns only the immediate child nodes with the given local element name.
export const directChildrenByLocalName = (node, localName) => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];

  return Object.entries(node).flatMap(([key, value]) => {
    if (key.startsWith('@_') || getLocalName(key) !== localName) {
      return [];
    }

    return toArray(value);
  });
};

// Recursively collects all descendant nodes whose element local name matches.
// Used to reach deeply nested LIDO elements regardless of nesting depth.
export const collectDescendantsByLocalName = (node, localName, matches = []) => {
  if (node === null || node === undefined) return matches;

  if (Array.isArray(node)) {
    node.forEach((entry) => collectDescendantsByLocalName(entry, localName, matches));
    return matches;
  }

  if (typeof node !== 'object') return matches;

  Object.entries(node).forEach(([key, value]) => {
    if (key.startsWith('@_')) return;

    if (getLocalName(key) === localName) {
      toArray(value).forEach((entry) => matches.push(entry));
    }

    collectDescendantsByLocalName(value, localName, matches);
  });

  return matches;
};

// Extracts text values from direct children matching any of the given local names.
// Applies `extractor` (default: extractAllTexts) to each matched child node.
export const extractDirectChildValues = (node, localNames, extractor = extractAllTexts) => uniqueStrings(
  toArray(localNames).flatMap((localName) => directChildrenByLocalName(node, localName).flatMap((entry) => extractor(entry)))
);

// Like extractDirectChildValues but searches all descendants, not just direct children.
export const extractDescendantValues = (node, localNames, extractor = extractAllTexts) => uniqueStrings(
  toArray(localNames).flatMap((localName) => collectDescendantsByLocalName(node, localName).flatMap((entry) => extractor(entry)))
);

const collectTextValues = (node, values = []) => {
  if (node === null || node === undefined) return values;

  if (Array.isArray(node)) {
    node.forEach((entry) => collectTextValues(entry, values));
    return values;
  }

  if (['string', 'number', 'boolean'].includes(typeof node)) {
    values.push(String(node));
    return values;
  }

  if (typeof node !== 'object') return values;

  Object.entries(node).forEach(([key, value]) => {
    if (key.startsWith('@_')) return;

    if (TEXT_NODE_KEYS.has(key)) {
      collectTextValues(value, values);
      return;
    }

    collectTextValues(value, values);
  });

  return values;
};

// Recursively collects all leaf text values from a node, ignoring attribute keys.
export const extractAllTexts = (node) => uniqueStrings(collectTextValues(node));

// Extracts only the inline text values sitting directly on a node (i.e. #text keys),
// without recursing into child elements. Used to read a node's own text content.
export const extractDirectTextValues = (node) => {
  if (node === null || node === undefined) return [];

  if (Array.isArray(node)) {
    return uniqueStrings(node.flatMap((entry) => extractDirectTextValues(entry)));
  }

  if (['string', 'number', 'boolean'].includes(typeof node)) {
    return [String(node)];
  }

  if (typeof node !== 'object') return [];

  return uniqueStrings(Object.entries(node).flatMap(([key, value]) => {
    if (key.startsWith('@_') || !isTextNodeKey(key)) {
      return [];
    }

    return extractAllTexts(value);
  }));
};

// Extracts concept label terms from a node.
// Prefers direct `term` children; falls back to all text content if none found.
export const extractConceptTerms = (node) => {
  const terms = extractDirectChildValues(node, 'term');
  return terms.length ? uniqueStrings(terms) : extractAllTexts(node);
};

// Extracts all appellationValue text nodes from any depth under `node`.
export const extractAppellationValues = (node) => extractDescendantValues(node, 'appellationValue');

// Extracts display values from the specified child element local names.
export const extractDisplayValues = (node, localNames = []) => extractDirectChildValues(node, localNames);

// Extracts legalBodyName appellation texts from any depth under `node`.
export const extractLegalBodyNames = (node) => extractDescendantValues(node, 'legalBodyName', extractAppellationValues);

// Extracts a human-readable place label.
// Prefers displayPlace/displayRepository; falls back to namePlaceSet appellation values.
export const extractPlaceValues = (node) => {
  const displayValues = extractDisplayValues(node, ['displayPlace', 'displayRepository']);
  if (displayValues.length) return displayValues;

  return uniqueStrings([
    ...collectDescendantsByLocalName(node, 'namePlaceSet').flatMap((entry) => extractAppellationValues(entry)),
    ...collectDescendantsByLocalName(node, 'place').flatMap((entry) => collectDescendantsByLocalName(entry, 'namePlaceSet').flatMap((placeNameNode) => extractAppellationValues(placeNameNode)))
  ]);
};

// Builds a compact date label from a LIDO date node.
// Returns "earliest - latest" for ranges, or the single date value if both ends are equal.
export const buildDateRangeLabels = (dateNode) => {
  const earliest = extractDirectChildValues(dateNode, 'earliestDate');
  const latest = extractDirectChildValues(dateNode, 'latestDate');

  if (earliest[0] && latest[0] && earliest[0] !== latest[0]) {
    return [`${earliest[0]} - ${latest[0]}`];
  }

  return uniqueStrings([...earliest, ...latest]);
};

// Extracts a date value from a node: prefers displayDate, then constructs from
// earliestDate/latestDate using buildDateRangeLabels.
export const extractDateValues = (node) => uniqueStrings([
  ...extractDisplayValues(node, ['displayDate']),
  ...extractDirectChildValues(node, 'date', buildDateRangeLabels)
]);

// Returns true if a string value looks like an HTTP/HTTPS URL.
export const looksLikeUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const sanitizePathValue = (value) => String(value || '')
  .trim()
  .replace(/[\[\]{}]/g, ' ')
  .replace(/\s+/g, ' ');

// Builds a dot-separated field path segment from an element local name.
// Qualifies ambiguous elements with their XML attributes (e.g. `event{type=Production}`).
export const pathSegment = (localName, node, attributes = ['type', 'label', 'pref']) => {
  const qualifiers = attributes
    .map((attribute) => {
      const value = sanitizePathValue(getAttribute(node, attribute));
      return value ? `${attribute}=${value}` : null;
    })
    .filter(Boolean);

  return qualifiers.length ? `${localName}{${qualifiers.join(';')}}` : localName;
};

// Joins path segments with `.`, filtering out empty/null segments.
export const joinPath = (...segments) => segments.filter(Boolean).join('.');
