import { appendValue, finalizeRow, uniqueStrings } from '../../shared/presetUtils.js';

const TEXT_NODE_NAMES = new Set(['#text', '#cdata-section', 'text', '__text']);

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const stripPrefix = (key = '') => {
  const withoutAttributePrefix = key.startsWith('@_') ? key.slice(2) : key;
  const parts = withoutAttributePrefix.split(':');
  return parts[parts.length - 1];
};

const normalizeText = (value) => String(value ?? '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const childEntries = (node) => {
  if (!isObject(node)) return [];
  return Object.entries(node).filter(([key]) => !key.startsWith('@_'));
};

const structuredChildEntries = (node) => childEntries(node).filter(([key]) => !TEXT_NODE_NAMES.has(stripPrefix(key)));

const extractPrimitiveText = (value) => {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return uniqueStrings(value.flatMap((entry) => extractPrimitiveText(entry)));
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const normalized = String(value).trim();
    return normalized ? [normalized] : [];
  }

  return [];
};

const extractDirectText = (node) => {
  if (!isObject(node)) {
    return extractPrimitiveText(node);
  }

  const values = [];

  Object.entries(node).forEach(([key, value]) => {
    if (TEXT_NODE_NAMES.has(stripPrefix(key))) {
      values.push(...extractPrimitiveText(value));
    }
  });

  return uniqueStrings(values);
};

const extractAllTexts = (node) => {
  if (Array.isArray(node)) {
    return uniqueStrings(node.flatMap((entry) => extractAllTexts(entry)));
  }

  if (!isObject(node)) {
    return extractPrimitiveText(node);
  }

  const values = [];
  values.push(...extractDirectText(node));

  childEntries(node).forEach(([key, value]) => {
    if (!TEXT_NODE_NAMES.has(stripPrefix(key))) {
      values.push(...extractAllTexts(value));
    }
  });

  return uniqueStrings(values);
};

const getAttribute = (node, attributeName) => {
  if (!isObject(node)) return null;

  const entry = Object.entries(node).find(([key]) => key.startsWith('@_') && stripPrefix(key) === attributeName);
  return entry ? entry[1] : null;
};

const getNumericAttribute = (node, attributeName) => {
  const raw = getAttribute(node, attributeName);
  if (raw === null || raw === undefined || raw === '') return Number.POSITIVE_INFINITY;

  const parsed = Number.parseInt(String(raw), 10);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

const getPreferenceRank = (node) => {
  const pref = normalizeText(getAttribute(node, 'pref'));
  if (!pref) return 1;
  if (pref.includes('preferred')) return 0;
  if (pref.includes('alternative')) return 2;
  return 1;
};

const sortNodes = (nodes) => [...nodes].sort((left, right) => {
  const leftPreference = getPreferenceRank(left);
  const rightPreference = getPreferenceRank(right);

  if (leftPreference !== rightPreference) {
    return leftPreference - rightPreference;
  }

  return getNumericAttribute(left, 'sortorder') - getNumericAttribute(right, 'sortorder');
});

const directChildrenByLocalName = (node, localName) => {
  if (Array.isArray(node)) {
    return node.flatMap((entry) => directChildrenByLocalName(entry, localName));
  }

  if (!isObject(node)) return [];

  const results = [];
  childEntries(node).forEach(([key, value]) => {
    if (stripPrefix(key) === localName) {
      results.push(...toArray(value));
    }
  });

  return results;
};

const collectDescendantsByLocalName = (node, localName, target = []) => {
  if (Array.isArray(node)) {
    node.forEach((entry) => collectDescendantsByLocalName(entry, localName, target));
    return target;
  }

  if (!isObject(node)) return target;

  childEntries(node).forEach(([key, value]) => {
    if (stripPrefix(key) === localName) {
      target.push(...toArray(value));
    }

    collectDescendantsByLocalName(value, localName, target);
  });

  return target;
};

const hasDescendant = (node, localName) => collectDescendantsByLocalName(node, localName).length > 0;

const firstValue = (values) => uniqueStrings(values)[0] || null;

const looksLikeUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const extractConceptTerms = (node) => {
  const termNodes = sortNodes(collectDescendantsByLocalName(node, 'term'));
  const termValues = uniqueStrings(termNodes.flatMap((entry) => extractAllTexts(entry)));
  if (termValues.length) return termValues;

  const skosConceptNodes = collectDescendantsByLocalName(node, 'Concept');
  const skosLabels = [];

  skosConceptNodes.forEach((conceptNode) => {
    ['prefLabel', 'altLabel', 'label', 'notation'].forEach((labelName) => {
      skosLabels.push(...collectDescendantsByLocalName(conceptNode, labelName).flatMap((entry) => extractAllTexts(entry)));
    });
  });

  if (skosLabels.length) return uniqueStrings(skosLabels);

  const directTexts = extractDirectText(node);
  if (directTexts.length && !hasDescendant(node, 'conceptID')) {
    return directTexts;
  }

  const conceptIds = collectDescendantsByLocalName(node, 'conceptID').flatMap((entry) => extractAllTexts(entry));
  return uniqueStrings(conceptIds);
};

const extractMixedConceptValues = (node) => {
  if (!isObject(node)) {
    return extractPrimitiveText(node);
  }

  const directTexts = extractDirectText(node);
  const hasConceptDescendants = hasDescendant(node, 'term') || hasDescendant(node, 'conceptID') || hasDescendant(node, 'Concept');

  if (directTexts.length && !hasConceptDescendants) {
    return directTexts;
  }

  const conceptTerms = extractConceptTerms(node);
  if (conceptTerms.length) return conceptTerms;

  return directTexts.length ? directTexts : extractAllTexts(node);
};

const extractAppellationValues = (node) => {
  const appellationNodes = sortNodes(collectDescendantsByLocalName(node, 'appellationValue'));
  const appellations = uniqueStrings(appellationNodes.flatMap((entry) => extractAllTexts(entry)));
  if (appellations.length) return appellations;
  return extractAllTexts(node);
};

const extractDisplayValues = (node, localNames) => uniqueStrings(
  localNames.flatMap((localName) => collectDescendantsByLocalName(node, localName).flatMap((entry) => extractAllTexts(entry)))
);

const extractDateRangeValue = (node) => {
  const earliest = firstValue(directChildrenByLocalName(node, 'earliestDate').flatMap((entry) => extractAllTexts(entry)));
  const latest = firstValue(directChildrenByLocalName(node, 'latestDate').flatMap((entry) => extractAllTexts(entry)));

  if (earliest && latest) {
    return earliest === latest ? earliest : `${earliest} - ${latest}`;
  }

  return earliest || latest || firstValue(extractDirectText(node));
};

const extractDateValues = (node) => {
  const displayValues = extractDisplayValues(node, ['displayDate']);
  if (displayValues.length) return displayValues;

  const dateLikeNodes = [
    ...collectDescendantsByLocalName(node, 'date'),
    ...collectDescendantsByLocalName(node, 'rightsDate'),
    ...collectDescendantsByLocalName(node, 'vitalDatesActor')
  ];

  const values = dateLikeNodes
    .map((entry) => extractDateRangeValue(entry))
    .filter(Boolean);

  return uniqueStrings(values);
};

const extractActorEntries = (node) => {
  const actorInRoleNodes = collectDescendantsByLocalName(node, 'actorInRole');
  const actorNodes = actorInRoleNodes.length ? [] : collectDescendantsByLocalName(node, 'actor');
  const candidateNodes = actorInRoleNodes.length ? actorInRoleNodes : actorNodes;

  return sortNodes(candidateNodes).map((actorNode) => {
    const actorSubnode = firstValue(directChildrenByLocalName(actorNode, 'actor')) ? directChildrenByLocalName(actorNode, 'actor')[0] : actorNode;
    const names = extractAppellationValues(actorSubnode);
    const roles = uniqueStrings(directChildrenByLocalName(actorNode, 'roleActor').flatMap((entry) => extractConceptTerms(entry)));
    return {
      names,
      roles
    };
  }).filter((entry) => entry.names.length || entry.roles.length);
};

const extractPlaceValues = (node) => {
  const displayValues = extractDisplayValues(node, ['displayPlace', 'displayRepository']);
  if (displayValues.length) return displayValues;

  const placeNodes = [
    ...collectDescendantsByLocalName(node, 'place'),
    ...collectDescendantsByLocalName(node, 'repositoryLocation'),
    ...collectDescendantsByLocalName(node, 'vitalPlaceActor'),
    ...collectDescendantsByLocalName(node, 'partOfPlace')
  ];

  const names = placeNodes.flatMap((placeNode) => {
    const nameSets = directChildrenByLocalName(placeNode, 'namePlaceSet');
    if (nameSets.length) {
      return nameSets.flatMap((entry) => extractAppellationValues(entry));
    }

    return extractAppellationValues(placeNode);
  });

  return uniqueStrings(names);
};

const extractLegalBodyNames = (node) => {
  const displayValues = extractDisplayValues(node, ['displayRepository']);
  const legalBodyNames = collectDescendantsByLocalName(node, 'legalBodyName').flatMap((entry) => extractAppellationValues(entry));
  return uniqueStrings([...displayValues, ...legalBodyNames]);
};

const extractIdentifierValues = (node, localNames) => {
  const idNodes = sortNodes(localNames.flatMap((localName) => collectDescendantsByLocalName(node, localName)));
  return uniqueStrings(idNodes.flatMap((entry) => extractAllTexts(entry)));
};

const formatMeasurementEntry = (measurementNode, qualifierValues = [], extentValues = [], formatValues = [], shapeValues = [], scaleValues = []) => {
  const typeValues = uniqueStrings(directChildrenByLocalName(measurementNode, 'measurementType').flatMap((entry) => extractMixedConceptValues(entry)));
  const unitValues = uniqueStrings(directChildrenByLocalName(measurementNode, 'measurementUnit').flatMap((entry) => extractMixedConceptValues(entry)));
  const valueValues = uniqueStrings(directChildrenByLocalName(measurementNode, 'measurementValue').flatMap((entry) => extractAllTexts(entry)));

  if (!typeValues.length && !valueValues.length) return null;

  const typeLabel = typeValues.join(', ');
  const valueLabel = valueValues.join(', ');
  const unitLabel = unitValues.join(', ');
  const mainLabel = [
    typeLabel ? `${typeLabel}${valueLabel ? `: ${valueLabel}` : ''}` : valueLabel,
    unitLabel
  ].filter(Boolean).join(' ');

  const qualifiers = [];
  if (qualifierValues.length) qualifiers.push(`qualifier ${qualifierValues.join(', ')}`);
  if (extentValues.length) qualifiers.push(`extent ${extentValues.join(', ')}`);
  if (formatValues.length) qualifiers.push(`format ${formatValues.join(', ')}`);
  if (shapeValues.length) qualifiers.push(`shape ${shapeValues.join(', ')}`);
  if (scaleValues.length) qualifiers.push(`scale ${scaleValues.join(', ')}`);

  if (!qualifiers.length) {
    return {
      label: mainLabel,
      typeValues
    };
  }

  return {
    label: `${mainLabel}; ${qualifiers.join('; ')}`,
    typeValues
  };
};

const extractMeasurementEntries = (node) => {
  const objectMeasurementsNodes = collectDescendantsByLocalName(node, 'objectMeasurements');
  const entries = [];

  objectMeasurementsNodes.forEach((objectMeasurementsNode) => {
    const qualifierValues = uniqueStrings(directChildrenByLocalName(objectMeasurementsNode, 'qualifierMeasurements').flatMap((entry) => extractMixedConceptValues(entry)));
    const extentValues = uniqueStrings(directChildrenByLocalName(objectMeasurementsNode, 'extentMeasurements').flatMap((entry) => extractMixedConceptValues(entry)));
    const formatValues = uniqueStrings(directChildrenByLocalName(objectMeasurementsNode, 'formatMeasurements').flatMap((entry) => extractMixedConceptValues(entry)));
    const shapeValues = uniqueStrings(directChildrenByLocalName(objectMeasurementsNode, 'shapeMeasurements').flatMap((entry) => extractMixedConceptValues(entry)));
    const scaleValues = uniqueStrings(directChildrenByLocalName(objectMeasurementsNode, 'scaleMeasurements').flatMap((entry) => extractMixedConceptValues(entry)));

    directChildrenByLocalName(objectMeasurementsNode, 'measurementsSet').forEach((measurementNode) => {
      const formatted = formatMeasurementEntry(
        measurementNode,
        qualifierValues,
        extentValues,
        formatValues,
        shapeValues,
        scaleValues
      );

      if (formatted) {
        entries.push(formatted);
      }
    });
  });

  return entries;
};

const isWeightMeasurement = (typeValues) => {
  const normalized = normalizeText(typeValues.join(' '));
  return normalized.includes('weight') || normalized.includes('mass');
};

const classifyMaterialValue = (termNode, value) => {
  const typeHint = normalizeText(getAttribute(termNode, 'type'));
  const valueHint = normalizeText(value);
  const combined = `${typeHint} ${valueHint}`.trim();

  if (
    combined.includes('technique')
    || combined.includes('method')
    || combined.includes('process')
    || combined.includes('manufactur')
    || combined.includes('carv')
    || combined.includes('cast')
    || combined.includes('engr')
    || combined.includes('paint')
    || combined.includes('draw')
    || combined.includes('print')
    || combined.includes('weav')
  ) {
    return 'production technique';
  }

  return 'material';
};

const extractMaterialsByField = (node) => {
  const fieldValues = {
    material: [],
    'production technique': []
  };

  const materialSets = [
    ...collectDescendantsByLocalName(node, 'objectMaterialsTechSet'),
    ...collectDescendantsByLocalName(node, 'eventMaterialsTech')
  ];

  materialSets.forEach((materialSetNode) => {
    const displayValues = uniqueStrings(directChildrenByLocalName(materialSetNode, 'displayMaterialsTech').flatMap((entry) => extractAllTexts(entry)));
    const materialsTechNodes = directChildrenByLocalName(materialSetNode, 'materialsTech');

    if (!materialsTechNodes.length && displayValues.length) {
      fieldValues.material.push(...displayValues);
      return;
    }

    materialsTechNodes.forEach((materialsTechNode) => {
      const termNodes = directChildrenByLocalName(materialsTechNode, 'termMaterialsTech');
      const classifiedValues = [];

      termNodes.forEach((termNode) => {
        extractConceptTerms(termNode).forEach((value) => {
          classifiedValues.push({
            field: classifyMaterialValue(termNode, value),
            value
          });
        });
      });

      if (!classifiedValues.length) {
        const fallbackValues = displayValues.length ? displayValues : extractAllTexts(materialsTechNode);
        fieldValues.material.push(...fallbackValues);
        return;
      }

      classifiedValues.forEach(({ field, value }) => {
        fieldValues[field].push(value);
      });
    });
  });

  return {
    material: uniqueStrings(fieldValues.material),
    'production technique': uniqueStrings(fieldValues['production technique'])
  };
};

const collectSourceTexts = (node) => {
  const localNames = [
    'sourceAppellation',
    'sourceDescriptiveNote',
    'sourceMaterialsTech',
    'sourceActorInRole',
    'sourceRelatedWorkSet',
    'sourceRepositorySet',
    'sourceStateEdition'
  ];

  return uniqueStrings(localNames.flatMap((localName) => collectDescendantsByLocalName(node, localName).flatMap((entry) => extractAllTexts(entry))));
};

const summarizeEvent = (eventInfo) => {
  const pieces = [];

  if (eventInfo.display.length) {
    pieces.push(eventInfo.display.join(', '));
  } else if (eventInfo.typeTerms.length) {
    pieces.push(eventInfo.typeTerms.join(', '));
  }

  if (eventInfo.actorEntries.length) {
    const actorLabels = eventInfo.actorEntries
      .map((actorEntry) => {
        const roleLabel = actorEntry.roles.length ? `${actorEntry.roles.join(', ')}: ` : '';
        return `${roleLabel}${actorEntry.names.join(', ')}`;
      })
      .filter(Boolean);

    if (actorLabels.length) {
      pieces.push(`actors ${actorLabels.join('; ')}`);
    }
  }

  if (eventInfo.dateValues.length) {
    pieces.push(`date ${eventInfo.dateValues.join(', ')}`);
  }

  if (eventInfo.placeValues.length) {
    pieces.push(`place ${eventInfo.placeValues.join(', ')}`);
  }

  if (eventInfo.methodValues.length) {
    pieces.push(`method ${eventInfo.methodValues.join(', ')}`);
  }

  if (eventInfo.descriptionValues.length) {
    pieces.push(...eventInfo.descriptionValues);
  }

  return pieces.join('; ');
};

const PRODUCTION_KEYWORDS = ['creation', 'production', 'made', 'manufacture', 'manufactured', 'design', 'designed', 'built', 'paint', 'publication', 'published'];
const ACQUISITION_KEYWORDS = ['acquisition', 'acquired', 'purchase', 'purchased', 'gift', 'donation', 'bequest', 'loan', 'transfer', 'accession', 'ownership', 'provenance'];
const COLLECTION_KEYWORDS = ['collection', 'collecting', 'collector', 'discovery', 'discover', 'excavation', 'excavate', 'find', 'finding', 'found', 'field collection'];
const EXHIBITION_KEYWORDS = ['exhibition', 'display', 'displayed', 'shown'];

const eventMatchesKeywords = (eventInfo, keywords) => {
  const haystack = normalizeText([
    ...eventInfo.typeTerms,
    ...eventInfo.display,
    ...eventInfo.roleInEventTerms,
    ...eventInfo.actorEntries.flatMap((entry) => entry.roles)
  ].join(' '));

  return keywords.some((keyword) => haystack.includes(keyword));
};

const classifyEvent = (eventInfo) => {
  if (eventMatchesKeywords(eventInfo, PRODUCTION_KEYWORDS)) return 'production';
  if (eventMatchesKeywords(eventInfo, ACQUISITION_KEYWORDS)) return 'acquisition';
  if (eventMatchesKeywords(eventInfo, COLLECTION_KEYWORDS)) return 'collection';
  if (eventMatchesKeywords(eventInfo, EXHIBITION_KEYWORDS)) return 'exhibition';
  return 'generic';
};

const extractEventInfo = (eventSetNode) => {
  const display = uniqueStrings(directChildrenByLocalName(eventSetNode, 'displayEvent').flatMap((entry) => extractAllTexts(entry)));
  const eventNode = directChildrenByLocalName(eventSetNode, 'event')[0] || eventSetNode;
  const typeTerms = uniqueStrings(directChildrenByLocalName(eventNode, 'eventType').flatMap((entry) => extractConceptTerms(entry)));
  const roleInEventTerms = uniqueStrings(directChildrenByLocalName(eventNode, 'roleInEvent').flatMap((entry) => extractConceptTerms(entry)));
  const actorEntries = extractActorEntries(directChildrenByLocalName(eventNode, 'eventActor'));
  const dateValues = extractDateValues(directChildrenByLocalName(eventNode, 'eventDate'));
  const placeValues = extractPlaceValues(directChildrenByLocalName(eventNode, 'eventPlace'));
  const methodValues = uniqueStrings(directChildrenByLocalName(eventNode, 'eventMethod').flatMap((entry) => extractConceptTerms(entry)));
  const cultureValues = uniqueStrings(directChildrenByLocalName(eventNode, 'culture').flatMap((entry) => extractConceptTerms(entry)));
  const periodTerms = uniqueStrings(directChildrenByLocalName(eventNode, 'periodName').flatMap((entry) => extractConceptTerms(entry)));
  const descriptionValues = uniqueStrings(directChildrenByLocalName(eventNode, 'eventDescriptionSet').flatMap((entry) => {
    const descriptiveValues = collectDescendantsByLocalName(entry, 'descriptiveNoteValue').flatMap((noteEntry) => extractAllTexts(noteEntry));
    return descriptiveValues.length ? descriptiveValues : extractAllTexts(entry);
  }));
  const eventMaterials = extractMaterialsByField(eventNode);

  return {
    display,
    eventNode,
    typeTerms,
    roleInEventTerms,
    actorEntries,
    dateValues,
    placeValues,
    methodValues,
    cultureValues,
    periodTerms,
    descriptionValues,
    eventMaterials,
    summary: ''
  };
};

const PATH_ATTRIBUTE_NAMES = ['type', 'pref', 'label'];

const sanitizePathValue = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const formatPathAttributes = (node, attributeNames = PATH_ATTRIBUTE_NAMES) => {
  if (!isObject(node)) return '';

  const attributes = attributeNames.flatMap((attributeName) => {
    const rawValue = getAttribute(node, attributeName);
    const normalizedValue = sanitizePathValue(rawValue);
    return normalizedValue ? [`@${attributeName}=${normalizedValue}`] : [];
  });

  return attributes.length ? `[${attributes.join(',')}]` : '';
};

const pathSegment = (localName, node = null, attributeNames = PATH_ATTRIBUTE_NAMES) => {
  return `${localName}${node ? formatPathAttributes(node, attributeNames) : ''}`;
};

const appendPathHint = (segment, hintName, hintValue) => {
  const normalizedHint = sanitizePathValue(hintValue);
  if (!normalizedHint) return segment;
  return `${segment}[${hintName}=${normalizedHint}]`;
};

const joinPath = (...segments) => segments.filter(Boolean).join('.');

const appendMappedValue = (bucket, mappingHints, headerField, mappedFieldName, values, options = {}) => {
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

const appendIdentifierNodes = (bucket, mappingHints, node, basePath, localNames, mappedFieldName, options = {}) => {
  localNames.forEach((localName) => {
    sortNodes(collectDescendantsByLocalName(node, localName)).forEach((entry) => {
      appendMappedValue(
        bucket,
        mappingHints,
        joinPath(basePath, pathSegment(localName, entry, ['type', 'label', 'pref'])),
        mappedFieldName,
        extractAllTexts(entry),
        options
      );
    });
  });
};

const buildLidoPrefilledMapping = (rows, mappingHints) => {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!headers.length) return [];

  const explicitPrimary = Object.values(mappingHints).find((entry) => entry.primary === 1)?.headerField || null;
  const primaryHeader = explicitPrimary
    || headers.find((header) => mappingHints[header]?.mappedFieldName === 'object id')
    || headers.find((header) => mappingHints[header]?.mappedFieldName === 'designation')
    || headers[0];

  return headers.map((header) => ({
    headerField: header,
    mappedFieldName: mappingHints[header]?.mappedFieldName || null,
    primary: header === primaryHeader ? 1 : 0
  }));
};

const appendRightsValues = (bucket, mappingHints, rightsNode, basePath) => {
  const rightsTypeNodes = collectDescendantsByLocalName(rightsNode, 'rightsType');
  const rightsHolderNames = uniqueStrings(collectDescendantsByLocalName(rightsNode, 'rightsHolder').flatMap((entry) => extractLegalBodyNames(entry)));
  const creditLines = uniqueStrings(collectDescendantsByLocalName(rightsNode, 'creditLine').flatMap((entry) => extractAllTexts(entry)));

  rightsTypeNodes.forEach((rightsTypeNode) => {
    const values = extractConceptTerms(rightsTypeNode);
    const typeHint = normalizeText(getAttribute(rightsTypeNode, 'type'));
    const isSpecificLicense = typeHint.includes('lido00921') || values.some((value) => {
      const normalized = normalizeText(value);
      return normalized.includes('license')
        || normalized.includes('creative commons')
        || normalized.includes('rights statements')
        || looksLikeUrl(value);
    });

    appendMappedValue(
      bucket,
      mappingHints,
      joinPath(basePath, pathSegment('rightsType', rightsTypeNode, ['type', 'label', 'pref'])),
      isSpecificLicense ? 'license' : 'legal status',
      values
    );
  });

  appendMappedValue(bucket, mappingHints, joinPath(basePath, 'rightsHolder.legalBodyName.appellationValue'), 'legal status', rightsHolderNames);
  appendMappedValue(bucket, mappingHints, joinPath(basePath, 'creditLine'), 'legal status', creditLines);
};

const appendResourceValues = (bucket, mappingHints, resourceWrapNode, basePath) => {
  const resourceSetNodes = collectDescendantsByLocalName(resourceWrapNode, 'resourceSet');

  resourceSetNodes.forEach((resourceSetNode) => {
    const resourceSetPath = joinPath(basePath, pathSegment('resourceSet', resourceSetNode, ['type', 'label']));
    const resourceTypeValues = uniqueStrings(directChildrenByLocalName(resourceSetNode, 'resourceType').flatMap((entry) => extractConceptTerms(entry)));

    collectDescendantsByLocalName(resourceSetNode, 'linkResource').forEach((linkNode) => {
      const links = extractAllTexts(linkNode);
      const formatResource = normalizeText(getAttribute(linkNode, 'formatResource'));
      const isImage = formatResource.startsWith('image') || links.some((value) => /\.(avif|bmp|gif|jpe?g|png|svg|tiff?|webp)(\?|$)/i.test(value));

      appendMappedValue(
        bucket,
        mappingHints,
        joinPath(resourceSetPath, pathSegment('linkResource', linkNode, ['formatResource', 'type'])),
        (isImage || resourceTypeValues.some((value) => normalizeText(value).includes('image') || normalizeText(value).includes('photo'))) ? 'images' : 'weblink',
        links
      );
    });

    appendMappedValue(
      bucket,
      mappingHints,
      joinPath(resourceSetPath, 'resourceDescription'),
      'notes',
      uniqueStrings(directChildrenByLocalName(resourceSetNode, 'resourceDescription').flatMap((entry) => extractAllTexts(entry)))
    );

    appendRightsValues(bucket, mappingHints, directChildrenByLocalName(resourceSetNode, 'rightsResource'), joinPath(resourceSetPath, 'rightsResource'));
  });
};

const appendSubjectValues = (bucket, mappingHints, subjectWrapNode, basePath) => {
  const subjectSetNodes = collectDescendantsByLocalName(subjectWrapNode, 'subjectSet');

  subjectSetNodes.forEach((subjectSetNode) => {
    const subjectSetPath = joinPath(basePath, pathSegment('subjectSet', subjectSetNode, ['type', 'label']));
    appendMappedValue(
      bucket,
      mappingHints,
      joinPath(subjectSetPath, 'displaySubject'),
      'iconography',
      extractDisplayValues(subjectSetNode, ['displaySubject', 'displayActor', 'displayEvent', 'displayPlace', 'displayObject'])
    );

    directChildrenByLocalName(subjectSetNode, 'subject').forEach((subjectNode) => {
      const subjectPath = joinPath(subjectSetPath, pathSegment('subject', subjectNode, ['type', 'label']));

      appendMappedValue(bucket, mappingHints, joinPath(subjectPath, 'subjectConcept.term'), 'iconography', directChildrenByLocalName(subjectNode, 'subjectConcept').flatMap((entry) => extractConceptTerms(entry)));
      appendMappedValue(bucket, mappingHints, joinPath(subjectPath, 'subjectActor.actorInRole.actor.appellationValue'), 'iconography', directChildrenByLocalName(subjectNode, 'subjectActor').flatMap((entry) => extractActorEntries(entry).flatMap((actorEntry) => actorEntry.names)));

      const subjectEventInfos = directChildrenByLocalName(subjectNode, 'subjectEvent').map((entry) => extractEventInfo(entry));
      appendMappedValue(bucket, mappingHints, joinPath(subjectPath, 'subjectEvent.displayEvent'), 'iconography', subjectEventInfos.flatMap((info) => info.display));
      appendMappedValue(bucket, mappingHints, joinPath(subjectPath, 'subjectEvent.eventType.term'), 'iconography', subjectEventInfos.flatMap((info) => info.typeTerms));
      appendMappedValue(bucket, mappingHints, joinPath(subjectPath, 'subjectEvent.eventDescriptionSet.descriptiveNoteValue'), 'iconography', subjectEventInfos.flatMap((info) => info.descriptionValues));

      appendMappedValue(bucket, mappingHints, joinPath(subjectPath, 'subjectPlace.place.namePlaceSet.appellationValue'), 'iconography', directChildrenByLocalName(subjectNode, 'subjectPlace').flatMap((entry) => extractPlaceValues(entry)));
      appendMappedValue(bucket, mappingHints, joinPath(subjectPath, 'subjectObject.displayObject'), 'iconography', directChildrenByLocalName(subjectNode, 'subjectObject').flatMap((entry) => extractDisplayValues(entry, ['displayObject'])));
      appendMappedValue(bucket, mappingHints, joinPath(subjectPath, 'subjectObject.objectName.appellationValue'), 'iconography', directChildrenByLocalName(subjectNode, 'subjectObject').flatMap((entry) => collectDescendantsByLocalName(entry, 'objectName').flatMap((objectNameNode) => extractAppellationValues(objectNameNode))));
    });
  });
};

const appendRelatedWorksValues = (bucket, mappingHints, relatedWorksWrapNode, basePath) => {
  const relatedWorkSetNodes = collectDescendantsByLocalName(relatedWorksWrapNode, 'relatedWorkSet');

  relatedWorkSetNodes.forEach((relatedWorkSetNode) => {
    const relatedWorkPath = joinPath(basePath, pathSegment('relatedWorkSet', relatedWorkSetNode, ['type', 'label']));
    const relationTypeValues = uniqueStrings(directChildrenByLocalName(relatedWorkSetNode, 'relatedWorkRelType').flatMap((entry) => extractConceptTerms(entry)));
    const looksBibliographic = relationTypeValues.some((value) => {
      const normalized = normalizeText(value);
      return normalized.includes('bibliograph')
        || normalized.includes('publication')
        || normalized.includes('document')
        || normalized.includes('catalog')
        || normalized.includes('reference');
    });
    const targetField = looksBibliographic ? 'bibliography' : 'notes';

    appendMappedValue(bucket, mappingHints, joinPath(relatedWorkPath, 'displayRelatedWork'), targetField, directChildrenByLocalName(relatedWorkSetNode, 'displayRelatedWork').flatMap((entry) => extractAllTexts(entry)));
    appendMappedValue(bucket, mappingHints, joinPath(relatedWorkPath, 'sourceRelatedWorkSet'), targetField, directChildrenByLocalName(relatedWorkSetNode, 'sourceRelatedWorkSet').flatMap((entry) => extractAllTexts(entry)));
    appendMappedValue(bucket, mappingHints, joinPath(relatedWorkPath, 'relatedWorkRelType.term'), targetField, relationTypeValues);
    appendMappedValue(bucket, mappingHints, joinPath(relatedWorkPath, 'objectName.appellationValue'), targetField, collectDescendantsByLocalName(relatedWorkSetNode, 'objectName').flatMap((entry) => extractAppellationValues(entry)));
  });
};

const appendRepositoryValues = (bucket, mappingHints, repositoryWrapNode, basePath) => {
  const repositorySetNodes = collectDescendantsByLocalName(repositoryWrapNode, 'repositorySet');

  repositorySetNodes.forEach((repositorySetNode) => {
    const repositorySetPath = joinPath(basePath, pathSegment('repositorySet', repositorySetNode, ['type', 'label']));
    const targetField = normalizeText(getAttribute(repositorySetNode, 'type')).includes('former') || normalizeText(getAttribute(repositorySetNode, 'type')).includes('previous')
      ? 'provenance'
      : 'department and institution';

    appendIdentifierNodes(bucket, mappingHints, repositorySetNode, repositorySetPath, ['workID'], 'object id');
    appendMappedValue(bucket, mappingHints, joinPath(repositorySetPath, 'displayRepository'), targetField, directChildrenByLocalName(repositorySetNode, 'displayRepository').flatMap((entry) => extractAllTexts(entry)));
    appendMappedValue(bucket, mappingHints, joinPath(repositorySetPath, 'repositoryName.legalBodyName.appellationValue'), targetField, directChildrenByLocalName(repositorySetNode, 'repositoryName').flatMap((entry) => extractLegalBodyNames(entry)));
    appendMappedValue(bucket, mappingHints, joinPath(repositorySetPath, 'repositoryLocation.namePlaceSet.appellationValue'), targetField, directChildrenByLocalName(repositorySetNode, 'repositoryLocation').flatMap((entry) => extractPlaceValues(entry)));
  });
};

const appendEventValues = (bucket, mappingHints, eventWrapNode, basePath) => {
  const eventSetNodes = collectDescendantsByLocalName(eventWrapNode, 'eventSet');

  eventSetNodes.forEach((eventSetNode, index) => {
    const info = extractEventInfo(eventSetNode);
    const classification = classifyEvent(info);
    const eventTypeHint = info.typeTerms[0] || (classification !== 'generic' ? classification : `event-${index + 1}`);
    const eventBasePath = joinPath(basePath, appendPathHint(pathSegment('eventSet', eventSetNode, ['type']), 'event', eventTypeHint), 'event');
    const actorNames = uniqueStrings(info.actorEntries.flatMap((entry) => entry.names));
    const actorRoles = uniqueStrings(info.actorEntries.flatMap((entry) => entry.roles));

    if (classification === 'production') {
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventDate'), 'date made', info.dateValues);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventActor.actorInRole.actor.appellationValue'), 'producer', actorNames);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventPlace.place.namePlaceSet.appellationValue'), 'production place', info.placeValues);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventMethod.term'), 'production technique', info.methodValues);
      appendMappedValue(bucket, mappingHints, appendPathHint(joinPath(eventBasePath, 'eventMaterialsTech.termMaterialsTech'), 'field', 'production-technique'), 'production technique', info.eventMaterials['production technique']);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'culture.term'), 'ethnic attribution', info.cultureValues);

      if (info.periodTerms.length) {
        const reignTerms = info.periodTerms.filter((value) => {
          const normalized = normalizeText(value);
          return normalized.includes('dynasty') || normalized.includes('reign');
        });
        const residualTerms = info.periodTerms.filter((value) => !reignTerms.includes(value));

        appendMappedValue(bucket, mappingHints, appendPathHint(joinPath(eventBasePath, 'periodName.term'), 'field', 'reign'), 'reign associated name', reignTerms);
        appendMappedValue(bucket, mappingHints, appendPathHint(joinPath(eventBasePath, 'periodName.term'), 'field', 'period-style'), 'notes', residualTerms);
      }

      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventDescriptionSet.descriptiveNoteValue'), 'notes', info.descriptionValues);
      return;
    }

    if (classification === 'acquisition') {
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventDate'), 'accession date', info.dateValues);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventMethod.term'), 'accession method', info.methodValues);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventActor.actorInRole.actor.appellationValue'), 'prior source', actorNames);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventActor.actorInRole.roleActor.term'), 'prior source role', actorRoles);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'displayEvent'), 'provenance', info.display);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventType.term'), 'provenance', info.typeTerms);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventDescriptionSet.descriptiveNoteValue'), 'provenance', info.descriptionValues);
      return;
    }

    if (classification === 'collection') {
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventDate'), 'date collected', info.dateValues);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventPlace.place.namePlaceSet.appellationValue'), 'place collected', info.placeValues);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'displayEvent'), 'provenance', info.display);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventType.term'), 'provenance', info.typeTerms);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventDescriptionSet.descriptiveNoteValue'), 'provenance', info.descriptionValues);
      return;
    }

    if (classification === 'exhibition') {
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'displayEvent'), 'exhibition history', info.display);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventType.term'), 'exhibition history', info.typeTerms);
      appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventDescriptionSet.descriptiveNoteValue'), 'exhibition history', info.descriptionValues);
      return;
    }

    appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'displayEvent'), 'event', info.display);
    appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventType.term'), 'event', info.typeTerms);
    appendMappedValue(bucket, mappingHints, joinPath(eventBasePath, 'eventDescriptionSet.descriptiveNoteValue'), 'event', info.descriptionValues);
  });
};

const appendAdministrativeMetadata = (bucket, mappingHints, administrativeMetadataNode, basePath) => {
  appendRightsValues(bucket, mappingHints, directChildrenByLocalName(administrativeMetadataNode, 'rightsWorkWrap'), joinPath(basePath, 'rightsWorkWrap'));

  const recordWrapNode = directChildrenByLocalName(administrativeMetadataNode, 'recordWrap')[0];
  if (recordWrapNode) {
    const recordWrapPath = joinPath(basePath, 'recordWrap');

    appendIdentifierNodes(bucket, mappingHints, recordWrapNode, recordWrapPath, ['recordID'], 'object id');

    sortNodes(directChildrenByLocalName(recordWrapNode, 'recordType')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, joinPath(recordWrapPath, pathSegment('recordType', entry, ['type', 'label'])), 'notes', extractConceptTerms(entry));
    });

    appendMappedValue(bucket, mappingHints, joinPath(recordWrapPath, 'recordSource.legalBodyName.appellationValue'), 'department and institution', uniqueStrings(directChildrenByLocalName(recordWrapNode, 'recordSource').flatMap((entry) => extractLegalBodyNames(entry))));
    appendRightsValues(bucket, mappingHints, directChildrenByLocalName(recordWrapNode, 'recordRights'), joinPath(recordWrapPath, 'recordRights'));
    appendMappedValue(bucket, mappingHints, joinPath(recordWrapPath, 'recordInfoSet.recordInfoLink'), 'weblink', uniqueStrings(directChildrenByLocalName(recordWrapNode, 'recordInfoSet').flatMap((entry) => collectDescendantsByLocalName(entry, 'recordInfoLink').flatMap((linkEntry) => extractAllTexts(linkEntry)))));
    appendMappedValue(bucket, mappingHints, joinPath(recordWrapPath, 'collection.displayObject'), 'notes', directChildrenByLocalName(recordWrapNode, 'collection').flatMap((entry) => extractDisplayValues(entry, ['displayObject'])));
    appendMappedValue(bucket, mappingHints, joinPath(recordWrapPath, 'collection.objectName.appellationValue'), 'notes', directChildrenByLocalName(recordWrapNode, 'collection').flatMap((entry) => collectDescendantsByLocalName(entry, 'objectName').flatMap((objectNameNode) => extractAppellationValues(objectNameNode))));
  }

  appendResourceValues(bucket, mappingHints, directChildrenByLocalName(administrativeMetadataNode, 'resourceWrap'), joinPath(basePath, 'resourceWrap'));
};

const appendDescriptiveMetadata = (bucket, mappingHints, descriptiveMetadataNode, basePath) => {
  const objectClassificationWrap = directChildrenByLocalName(descriptiveMetadataNode, 'objectClassificationWrap')[0];
  if (objectClassificationWrap) {
    const classificationPath = joinPath(basePath, 'objectClassificationWrap');

    sortNodes(collectDescendantsByLocalName(objectClassificationWrap, 'objectWorkType')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, joinPath(classificationPath, pathSegment('objectWorkType', entry, ['type', 'label', 'pref']), 'term'), 'object type', extractConceptTerms(entry));
    });

    sortNodes(collectDescendantsByLocalName(objectClassificationWrap, 'classification')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, joinPath(classificationPath, pathSegment('classification', entry, ['type', 'label', 'pref']), 'term'), 'object type', extractConceptTerms(entry));
    });
  }

  const objectIdentificationWrap = directChildrenByLocalName(descriptiveMetadataNode, 'objectIdentificationWrap')[0];
  if (objectIdentificationWrap) {
    const identificationPath = joinPath(basePath, 'objectIdentificationWrap');

    sortNodes(collectDescendantsByLocalName(objectIdentificationWrap, 'titleSet')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, joinPath(identificationPath, pathSegment('titleSet', entry, ['type', 'label', 'pref']), 'appellationValue'), 'designation', extractAppellationValues(entry));
    });

    sortNodes(collectDescendantsByLocalName(objectIdentificationWrap, 'objectDescriptionSet')).forEach((entry) => {
      const descriptiveValues = collectDescendantsByLocalName(entry, 'descriptiveNoteValue').flatMap((noteEntry) => extractAllTexts(noteEntry));
      appendMappedValue(bucket, mappingHints, joinPath(identificationPath, pathSegment('objectDescriptionSet', entry, ['type', 'label']), 'descriptiveNoteValue'), 'description', descriptiveValues.length ? descriptiveValues : extractAllTexts(entry));
    });

    sortNodes(collectDescendantsByLocalName(objectIdentificationWrap, 'objectNote')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, joinPath(identificationPath, pathSegment('objectNote', entry, ['type', 'label'])), 'notes', extractAllTexts(entry));
    });

    appendMappedValue(bucket, mappingHints, joinPath(identificationPath, 'displayStateEditionWrap.displayState'), 'notes', directChildrenByLocalName(objectIdentificationWrap, 'displayStateEditionWrap').flatMap((entry) => extractDisplayValues(entry, ['displayState'])));
    appendMappedValue(bucket, mappingHints, joinPath(identificationPath, 'displayStateEditionWrap.displayEdition'), 'notes', directChildrenByLocalName(objectIdentificationWrap, 'displayStateEditionWrap').flatMap((entry) => extractDisplayValues(entry, ['displayEdition'])));

    sortNodes(collectDescendantsByLocalName(objectIdentificationWrap, 'inscriptionTranscription')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, joinPath(identificationPath, pathSegment('inscriptionTranscription', entry, ['type', 'label'])), 'inscriptions', extractAllTexts(entry));
    });

    sortNodes(collectDescendantsByLocalName(objectIdentificationWrap, 'inscriptionDescription')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, joinPath(identificationPath, pathSegment('inscriptionDescription', entry, ['type', 'label']), 'descriptiveNoteValue'), 'inscriptions', collectDescendantsByLocalName(entry, 'descriptiveNoteValue').flatMap((noteEntry) => extractAllTexts(noteEntry)));
    });

    appendRepositoryValues(bucket, mappingHints, directChildrenByLocalName(objectIdentificationWrap, 'repositoryWrap'), joinPath(identificationPath, 'repositoryWrap'));

    const measurementEntries = extractMeasurementEntries(directChildrenByLocalName(objectIdentificationWrap, 'objectMeasurementsWrap'));
    measurementEntries.filter((entry) => !isWeightMeasurement(entry.typeValues)).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, appendPathHint(joinPath(identificationPath, 'objectMeasurementsWrap.objectMeasurements.measurementsSet.measurementValue'), 'measurement', entry.typeValues[0] || 'dimension'), 'dimensions', [entry.label]);
    });
    measurementEntries.filter((entry) => isWeightMeasurement(entry.typeValues)).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, appendPathHint(joinPath(identificationPath, 'objectMeasurementsWrap.objectMeasurements.measurementsSet.measurementValue'), 'measurement', entry.typeValues[0] || 'weight'), 'weight', [entry.label]);
    });

    const materialsByField = extractMaterialsByField(directChildrenByLocalName(objectIdentificationWrap, 'objectMaterialsTechWrap'));
    appendMappedValue(bucket, mappingHints, appendPathHint(joinPath(identificationPath, 'objectMaterialsTechWrap.objectMaterialsTechSet.materialsTech.termMaterialsTech'), 'field', 'material'), 'material', materialsByField.material);
    appendMappedValue(bucket, mappingHints, appendPathHint(joinPath(identificationPath, 'objectMaterialsTechWrap.objectMaterialsTechSet.materialsTech.termMaterialsTech'), 'field', 'production-technique'), 'production technique', materialsByField['production technique']);
  }

  appendEventValues(bucket, mappingHints, directChildrenByLocalName(descriptiveMetadataNode, 'eventWrap'), joinPath(basePath, 'eventWrap'));

  const objectRelationWrap = directChildrenByLocalName(descriptiveMetadataNode, 'objectRelationWrap')[0];
  if (objectRelationWrap) {
    const relationPath = joinPath(basePath, 'objectRelationWrap');
    appendSubjectValues(bucket, mappingHints, directChildrenByLocalName(objectRelationWrap, 'subjectWrap'), joinPath(relationPath, 'subjectWrap'));
    appendRelatedWorksValues(bucket, mappingHints, directChildrenByLocalName(objectRelationWrap, 'relatedWorksWrap'), joinPath(relationPath, 'relatedWorksWrap'));
  }
};

const isLikelyLidoRecord = (node) => {
  if (!isObject(node)) return false;

  const hasLidoIdentifier = hasDescendant(node, 'lidoRecID');
  const hasDescriptiveMetadata = hasDescendant(node, 'descriptiveMetadata');
  const hasAdministrativeMetadata = hasDescendant(node, 'administrativeMetadata');

  return hasLidoIdentifier && hasDescriptiveMetadata && hasAdministrativeMetadata;
};

export const extractLidoNodes = (node, target = []) => {
  if (Array.isArray(node)) {
    node.forEach((entry) => extractLidoNodes(entry, target));
    return target;
  }

  if (!isObject(node)) return target;

  childEntries(node).forEach(([key, value]) => {
    const localName = stripPrefix(key);

    if (localName === 'lidoWrap') {
      directChildrenByLocalName(value, 'lido').forEach((entry) => {
        if (isLikelyLidoRecord(entry)) {
          target.push(entry);
        }
      });
      return;
    }

    if (localName === 'lido') {
      toArray(value).forEach((entry) => {
        if (isLikelyLidoRecord(entry)) {
          target.push(entry);
        }
      });
      return;
    }

    extractLidoNodes(value, target);
  });

  return target;
};

export const isLidoDocument = (data) => extractLidoNodes(data).length > 0;

const appendCollectedSourceTexts = (bucket, mappingHints, lidoNode) => {
  [
    'sourceAppellation',
    'sourceDescriptiveNote',
    'sourceMaterialsTech',
    'sourceActorInRole',
    'sourceRelatedWorkSet',
    'sourceRepositorySet',
    'sourceStateEdition'
  ].forEach((localName) => {
    appendMappedValue(
      bucket,
      mappingHints,
      localName,
      'bibliography',
      collectDescendantsByLocalName(lidoNode, localName).flatMap((entry) => extractAllTexts(entry))
    );
  });
};

export const extractLidoProjection = (data) => {
  const lidoNodes = extractLidoNodes(data);
  const mappingHints = {};

  const rows = lidoNodes.map((lidoNode) => {
    const bucket = {};

    appendIdentifierNodes(bucket, mappingHints, lidoNode, '', ['lidoRecID'], 'object id', { primary: true });
    appendIdentifierNodes(bucket, mappingHints, lidoNode, '', ['objectPublishedID'], 'object id');

    sortNodes(directChildrenByLocalName(lidoNode, 'category')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, joinPath(pathSegment('category', entry, ['type', 'label'])), 'notes', extractConceptTerms(entry));
    });

    sortNodes(collectDescendantsByLocalName(lidoNode, 'objectPublishedID')).forEach((entry) => {
      appendMappedValue(bucket, mappingHints, appendPathHint(joinPath(pathSegment('objectPublishedID', entry, ['type', 'label'])), 'format', 'url'), 'weblink', extractAllTexts(entry).filter((value) => looksLikeUrl(value)));
    });

    const descriptiveMetadataNode = directChildrenByLocalName(lidoNode, 'descriptiveMetadata')[0];
    if (descriptiveMetadataNode) {
      appendDescriptiveMetadata(bucket, mappingHints, descriptiveMetadataNode, 'descriptiveMetadata');
    }

    const administrativeMetadataNode = directChildrenByLocalName(lidoNode, 'administrativeMetadata')[0];
    if (administrativeMetadataNode) {
      appendAdministrativeMetadata(bucket, mappingHints, administrativeMetadataNode, 'administrativeMetadata');
    }

    appendCollectedSourceTexts(bucket, mappingHints, lidoNode);

    return finalizeRow(bucket);
  }).filter((row) => Object.keys(row).length > 0);

  return {
    rows,
    prefilledMapping: buildLidoPrefilledMapping(rows, mappingHints)
  };
};

export const extractLidoRows = (data) => extractLidoProjection(data).rows;