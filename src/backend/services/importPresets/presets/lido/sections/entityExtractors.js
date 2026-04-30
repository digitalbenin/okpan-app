import { uniqueStrings } from '../../../shared/presetUtils.js';
import {
  buildDateRangeLabels,
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractAppellationValues,
  extractConceptTerms,
  extractDescendantValues,
  extractDirectChildValues,
  extractDisplayValues,
  extractLegalBodyNames,
  extractPlaceValues,
  getAttribute,
  looksLikeUrl,
  normalizeText,
  sortNodes
} from '../lidoXmlUtils.js';
import { WEIGHT_HINTS, appendScopedField, buildIndexedScope, matchesAny } from './shared.js';

export const hasValues = (entry) => Object.values(entry).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));

export const extractIdentifierValues = (node, localNames) => extractDescendantValues(node, localNames);

const classifyMaterialsTechTarget = (termNode) => /(technique|process|method|implement|tool|watermark|medium)/.test(
  normalizeText(getAttribute(termNode, 'type') || getAttribute(termNode, 'label'))
) ? 'production technique' : 'material';

export const extractMaterialsByField = (node) => {
  const values = { material: [], 'production technique': [] };

  [
    ...collectDescendantsByLocalName(node, 'objectMaterialsTechSet'),
    ...collectDescendantsByLocalName(node, 'eventMaterialsTech')
  ].forEach((materialsSetNode) => {
    values.material.push(...extractDisplayValues(materialsSetNode, ['displayMaterialsTech']));

    directChildrenByLocalName(materialsSetNode, 'materialsTech').forEach((materialsTechNode) => {
      directChildrenByLocalName(materialsTechNode, 'termMaterialsTech').forEach((termNode) => {
        values[classifyMaterialsTechTarget(termNode)].push(...extractConceptTerms(termNode));
      });
    });
  });

  return {
    material: uniqueStrings(values.material),
    'production technique': uniqueStrings(values['production technique'])
  };
};

const extractMeasurementLabels = (objectMeasurementsNode) => uniqueStrings(
  directChildrenByLocalName(objectMeasurementsNode, 'measurementsSet').flatMap((measurementSetNode) => {
    const qualifiers = extractDirectChildValues(objectMeasurementsNode, [
      'extentMeasurements',
      'qualifierMeasurements',
      'formatMeasurements',
      'shapeMeasurements',
      'scaleMeasurements'
    ], extractConceptTerms);

    const mainLabel = [
      extractDirectChildValues(measurementSetNode, 'measurementType', extractConceptTerms).join('/'),
      extractDirectChildValues(measurementSetNode, 'measurementValue').join('/'),
      extractDirectChildValues(measurementSetNode, 'measurementUnit', extractConceptTerms).join('/')
    ].filter(Boolean).join(': ').replace(': :', ': ');

    if (!mainLabel) return [];
    return [qualifiers.length ? `${mainLabel} (${qualifiers.join('; ')})` : mainLabel];
  })
);

export const extractMeasurementsByField = (node) => {
  const values = { dimensions: [], weight: [] };

  collectDescendantsByLocalName(node, 'objectMeasurementsSet').forEach((measurementsSetNode) => {
    extractDisplayValues(measurementsSetNode, ['displayObjectMeasurements']).forEach((value) => {
      values[matchesAny([value], WEIGHT_HINTS) ? 'weight' : 'dimensions'].push(value);
    });

    directChildrenByLocalName(measurementsSetNode, 'objectMeasurements').forEach((objectMeasurementsNode) => {
      const typeTexts = directChildrenByLocalName(objectMeasurementsNode, 'measurementsSet')
        .flatMap((entry) => directChildrenByLocalName(entry, 'measurementType'))
        .flatMap((entry) => extractConceptTerms(entry));
      values[matchesAny(typeTexts, WEIGHT_HINTS) ? 'weight' : 'dimensions'].push(...extractMeasurementLabels(objectMeasurementsNode));
    });
  });

  return {
    dimensions: uniqueStrings(values.dimensions),
    weight: uniqueStrings(values.weight)
  };
};

export const extractStructuredDateEntries = (nodes, displayLocalNames = ['displayDate']) => sortNodes(nodes).map((node) => {
  const display = extractDirectChildValues(node, displayLocalNames);
  const effectiveDateNodes = directChildrenByLocalName(node, 'date');
  const dateNodes = effectiveDateNodes.length ? effectiveDateNodes : [node];

  return {
    display,
    values: uniqueStrings([...display, ...dateNodes.flatMap((dateNode) => buildDateRangeLabels(dateNode))]),
    start: uniqueStrings(dateNodes.flatMap((dateNode) => extractDirectChildValues(dateNode, 'earliestDate'))),
    end: uniqueStrings(dateNodes.flatMap((dateNode) => extractDirectChildValues(dateNode, 'latestDate')))
  };
}).filter(hasValues);

export const extractLegalBodyEntries = (nodes) => sortNodes(nodes).map((node) => ({
  ids: extractIdentifierValues(node, ['legalBodyID']),
  names: extractLegalBodyNames(node),
  weblinks: extractDescendantValues(node, 'legalBodyWeblink').filter((value) => looksLikeUrl(value))
})).filter(hasValues);

export const extractObjectSetEntries = (nodes) => sortNodes(nodes).map((node) => {
  const objectNode = directChildrenByLocalName(node, 'object')[0];

  return {
    display: uniqueStrings(extractDisplayValues(node, ['displayObject'])),
    ids: objectNode ? extractIdentifierValues(objectNode, ['objectID']) : [],
    names: objectNode ? extractDescendantValues(objectNode, 'objectName', extractAppellationValues) : [],
    types: objectNode ? extractDirectChildValues(objectNode, 'objectType', extractConceptTerms) : [],
    weblinks: objectNode ? extractDescendantValues(objectNode, 'objectWebResource').filter((value) => looksLikeUrl(value)) : [],
    notes: objectNode ? extractDirectChildValues(objectNode, 'objectNote') : []
  };
}).filter(hasValues);

export const extractPlaceSetEntries = (nodes, displayLocalNames = ['displayPlace']) => sortNodes(nodes).map((node) => ({
  display: extractDirectChildValues(node, displayLocalNames),
  ids: extractIdentifierValues(node, ['placeID']),
  names: extractPlaceValues(node),
  classifications: extractDescendantValues(node, 'placeClassification', extractConceptTerms)
})).filter(hasValues);

export const appendDateEntriesToScope = (bucket, mappingHints, scope, prefix, entries, mappedFieldName) => {
  entries.forEach((entry, index) => {
    appendScopedField(bucket, mappingHints, scope, [`${prefix}_${index}`, 'value'], mappedFieldName, entry.values);
    appendScopedField(bucket, mappingHints, scope, [`${prefix}_${index}`, 'display'], mappedFieldName, entry.display);
    appendScopedField(bucket, mappingHints, scope, [`${prefix}_${index}`, 'start'], mappedFieldName, entry.start);
    appendScopedField(bucket, mappingHints, scope, [`${prefix}_${index}`, 'end'], mappedFieldName, entry.end);
  });
};

const appendEntriesToScope = (bucket, mappingHints, scopePrefix, entries, callback) => {
  entries.forEach((entry, index) => callback(buildIndexedScope(scopePrefix, index), entry));
};

export const appendLegalBodyEntriesToScope = (bucket, mappingHints, scopePrefix, entries, mappedFieldName = 'department and institution') => {
  appendEntriesToScope(bucket, mappingHints, scopePrefix, entries, (scope, entry) => {
    appendScopedField(bucket, mappingHints, scope, ['id'], mappedFieldName, entry.ids);
    appendScopedField(bucket, mappingHints, scope, ['name'], mappedFieldName, entry.names);
    appendScopedField(bucket, mappingHints, scope, ['weblink'], 'weblink', entry.weblinks);
  });
};

export const appendObjectEntriesToScope = (bucket, mappingHints, scopePrefix, entries, mappedFieldName) => {
  appendEntriesToScope(bucket, mappingHints, scopePrefix, entries, (scope, entry) => {
    appendScopedField(bucket, mappingHints, scope, ['display'], mappedFieldName, entry.display);
    appendScopedField(bucket, mappingHints, scope, ['id'], mappedFieldName, entry.ids);
    appendScopedField(bucket, mappingHints, scope, ['name'], mappedFieldName, entry.names);
    appendScopedField(bucket, mappingHints, scope, ['type'], mappedFieldName, entry.types);
    appendScopedField(bucket, mappingHints, scope, ['weblink'], 'weblink', entry.weblinks);
    appendScopedField(bucket, mappingHints, scope, ['note'], mappedFieldName, entry.notes);
  });
};

export const appendPlaceEntriesToScope = (bucket, mappingHints, scopePrefix, entries, mappedFieldName) => {
  appendEntriesToScope(bucket, mappingHints, scopePrefix, entries, (scope, entry) => {
    appendScopedField(bucket, mappingHints, scope, ['display'], mappedFieldName, entry.display);
    appendScopedField(bucket, mappingHints, scope, ['id'], mappedFieldName, entry.ids);
    appendScopedField(bucket, mappingHints, scope, ['name'], mappedFieldName, entry.names);
    appendScopedField(bucket, mappingHints, scope, ['classification'], mappedFieldName, entry.classifications);
  });
};