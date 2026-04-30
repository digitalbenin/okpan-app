import { appendValue, uniqueStrings } from '../../../shared/presetUtils.js';
import {
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractAllTexts,
  extractAppellationValues,
  extractConceptTerms,
  extractDescendantValues,
  extractDirectChildValues,
  extractDirectTextValues,
  extractDisplayValues,
  extractPlaceValues,
  getAttribute,
  getLocalName,
  isTextNodeKey,
  joinPath,
  looksLikeUrl,
  normalizeText,
  pathSegment,
  sortNodes,
  toArray
} from '../lidoXmlUtils.js';

export const BIBLIOGRAPHY_HINTS = [/bibliograph/, /catalog/, /catalogue/, /publication/, /article/, /book/, /reference/];
export const LICENSE_HINTS = [/license/, /creative commons/, /rightsstatements\.org/, /cc[-\s]?by/];
export const LEGAL_STATUS_HINTS = [
  /copyright/,
  /public domain/,
  /rights reserved/,
  /rechte vorbehalten/,
  /alle rechte vorbehalten/,
  /restriction/,
  /restricted/,
  /permission/,
  /ownership/,
  /reproduction rights/,
  /usage rights/,
  /nutzungsrechte/,
  /freier zugang/
];
export const WEIGHT_HINTS = [/weight/, /mass/];

export const matchesAny = (values, patterns) => values
  .map((value) => normalizeText(value))
  .some((value) => patterns.some((pattern) => pattern.test(value)));

export const classifyRightsTarget = (values) => {
  if (matchesAny(values, LICENSE_HINTS)) return 'license';
  if (matchesAny(values, LEGAL_STATUS_HINTS)) return 'legal status';
  return null;
};

const inferResidualTargetField = (headerField, values = []) => {
  const normalizedPath = normalizeText(headerField).replace(/\u007f/g, '');
  if (!normalizedPath) return null;

  for (const [pattern, resolver] of [
    [/legalbodyweblink|recordinfolink|linkresource|objectpublishedid\[url\]|weblink|url|uri/, () => 'weblink'],
    [/rightstype|copyright|rightsresource|rightsworkset|recordrights|rightsworkwrap|legalstatus/, () => classifyRightsTarget(values) || 'legal status'],
    [/creditline|displayedition|objectnote|resourcedescription|descriptivenote|note/, () => 'notes'],
    [/rightsholder|recordsource|resourcesource|repository|legalbodyname|legalbodyid|collection\./, () => 'department and institution'],
    [/lido\.category|objectworktype|classificationwrap\.classification|\.classification\./, () => 'object type'],
    [/recordtype/, () => 'object type'],
    [/displaystate/, () => 'display status'],
    [/objectdescriptionwrap/, () => 'description'],
    [/inscription/, () => 'inscriptions'],
    [/subject/, () => 'iconography'],
    [/relatedwork|sourcerelatedworkset/, () => matchesAny(values, BIBLIOGRAPHY_HINTS) ? 'bibliography' : 'notes'],
    [/eventwrap|eventset|\.event\./, () => /exhibition/.test(normalizedPath) ? 'exhibition history' : 'event'],
    [/materialstech/, () => matchesAny(values, [/technique/, /process/, /method/, /medium/, /tool/]) ? 'production technique' : 'material'],
    [/measurement|dimensions/, () => matchesAny(values, WEIGHT_HINTS) || /weight/.test(normalizedPath) ? 'weight' : 'dimensions']
  ]) {
    if (pattern.test(normalizedPath)) return resolver();
  }

  return 'notes';
};

export const appendMappedValue = (bucket, mappingHints, headerField, mappedFieldName, values, options = {}) => {
  const normalizedValues = uniqueStrings(values);
  if (!headerField || !normalizedValues.length) return;

  appendValue(bucket, headerField, normalizedValues);

  const existing = mappingHints[headerField] || {
    headerField,
    mappedFieldName: null,
    primary: 0
  };

  if (mappedFieldName && !existing.mappedFieldName) {
    existing.mappedFieldName = mappedFieldName;
  }

  if (options.primary) {
    existing.primary = 1;
  }

  mappingHints[headerField] = existing;
};

export const appendResidualTreeValues = (
  bucket,
  mappingHints,
  node,
  basePath,
  mappedFieldName,
  handledLocalNames = []
) => {
  const handled = new Set(handledLocalNames);

  const visit = (currentNode, currentPath) => {
    if (currentNode === null || currentNode === undefined || !currentPath) return;

    if (Array.isArray(currentNode)) {
      currentNode.forEach((entry) => visit(entry, currentPath));
      return;
    }

    if (['string', 'number', 'boolean'].includes(typeof currentNode)) {
      const textValues = [String(currentNode)];
      appendMappedValue(bucket, mappingHints, currentPath, mappedFieldName || inferResidualTargetField(currentPath, textValues), textValues);
      return;
    }

    if (typeof currentNode !== 'object') return;

    const directValues = extractDirectTextValues(currentNode);
    appendMappedValue(bucket, mappingHints, currentPath, mappedFieldName || inferResidualTargetField(currentPath, directValues), directValues);

    Object.entries(currentNode).forEach(([key, value]) => {
      if (key.startsWith('@_') || isTextNodeKey(key)) return;

      const localName = getLocalName(key);
      if (handled.has(localName)) return;

      toArray(value).forEach((entry) => {
        visit(entry, joinPath(currentPath, pathSegment(localName, entry, ['type', 'label', 'pref', 'sortorder'])));
      });
    });
  };

  visit(node, basePath);
};

export const buildPrefilledMapping = (rows, mappingHints) => {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!headers.length) return [];

  const explicitPrimary = Object.values(mappingHints).find((entry) => entry.primary === 1)?.headerField;
  const primaryHeader = explicitPrimary
    || headers.find((header) => mappingHints[header]?.mappedFieldName === 'object id')
    || headers.find((header) => mappingHints[header]?.mappedFieldName === 'designation')
    || headers[0];

  return headers.map((header) => ({
    headerField: header,
    mappedField: null,
    mappedFieldName: mappingHints[header]?.mappedFieldName || null,
    primary: header === primaryHeader ? 1 : 0
  }));
};

export const extractLidoNodes = (data) => {
  const wrappers = collectDescendantsByLocalName(data, 'lidoWrap');
  if (wrappers.length) {
    return wrappers.flatMap((entry) => directChildrenByLocalName(entry, 'lido'));
  }

  return collectDescendantsByLocalName(data, 'lido');
};

export const buildIndexedScope = (prefix, index) => `${prefix}_${index}`;

export const buildScopedField = (scope, ...segments) => joinPath(scope, ...segments.filter(Boolean));

export const appendScopedField = (bucket, mappingHints, scope, segments, mappedFieldName, values, options = {}) => {
  appendMappedValue(bucket, mappingHints, buildScopedField(scope, ...segments), mappedFieldName, values, options);
};

export {
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractAllTexts,
  extractAppellationValues,
  extractConceptTerms,
  extractDescendantValues,
  extractDirectChildValues,
  extractDisplayValues,
  extractPlaceValues,
  getAttribute,
  looksLikeUrl,
  normalizeText,
  sortNodes,
  uniqueStrings
};