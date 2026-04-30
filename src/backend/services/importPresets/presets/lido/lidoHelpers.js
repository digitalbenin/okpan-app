import { finalizeRow } from '../../shared/presetUtils.js';
import { appendAdministrativeMetadataValues } from './sections/administrativeMetadata.js';
import { appendDescriptiveMetadataValues } from './sections/descriptiveMetadata.js';
import { extractIdentifierValues } from './sections/entityExtractors.js';
import {
  appendResidualTreeValues,
  appendScopedField,
  buildPrefilledMapping,
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractConceptTerms,
  extractLidoNodes,
  extractDescendantValues,
  looksLikeUrl
} from './sections/shared.js';

const SOURCE_TEXT_NAMES = [
  'sourceAppellation',
  'sourceDescriptiveNote',
  'sourceMaterialsTech',
  'sourceActorInRole',
  'sourceRelatedWorkSet',
  'sourceRepositorySet',
  'sourceStateEdition'
];

const appendBibliographySources = (bucket, mappingHints, lidoNode) => {
  SOURCE_TEXT_NAMES.forEach((localName, index) => {
    appendScopedField(
      bucket,
      mappingHints,
      'bibliography',
      [`${localName}_${index}`],
      'bibliography',
      extractDescendantValues(lidoNode, localName)
    );
  });
};

export function isLidoDocument(data) {
  return extractLidoNodes(data).length > 0 || collectDescendantsByLocalName(data, 'lidoWrap').length > 0;
}

export function extractLidoProjection(data) {
  const lidoNodes = extractLidoNodes(data);
  const mappingHints = {};

  const rows = lidoNodes.map((lidoNode) => {
    const bucket = {};

    appendScopedField(bucket, mappingHints, 'lido', ['record_id'], 'object id', extractIdentifierValues(lidoNode, ['lidoRecID']), { primary: true });
    appendScopedField(bucket, mappingHints, 'lido', ['published_object_id'], 'object id', extractIdentifierValues(lidoNode, ['objectPublishedID']));
    appendScopedField(bucket, mappingHints, 'lido', ['published_object_url'], 'weblink', extractIdentifierValues(lidoNode, ['objectPublishedID']).filter((value) => looksLikeUrl(value)));
    appendScopedField(bucket, mappingHints, 'lido', ['application_profile'], 'notes', extractIdentifierValues(lidoNode, ['applicationProfile']));
    appendScopedField(bucket, mappingHints, 'object_classification', ['category'], 'object type', directChildrenByLocalName(lidoNode, 'category').flatMap((entry) => extractConceptTerms(entry)));

    directChildrenByLocalName(lidoNode, 'descriptiveMetadata').forEach((descriptiveMetadataNode) => {
      appendDescriptiveMetadataValues(bucket, mappingHints, descriptiveMetadataNode);
    });

    directChildrenByLocalName(lidoNode, 'administrativeMetadata').forEach((administrativeMetadataNode) => {
      appendAdministrativeMetadataValues(bucket, mappingHints, administrativeMetadataNode);
    });

    appendBibliographySources(bucket, mappingHints, lidoNode);
    appendResidualTreeValues(bucket, mappingHints, lidoNode, 'lido.raw', null, ['lidoRecID', 'objectPublishedID', 'applicationProfile', 'category', 'descriptiveMetadata', 'administrativeMetadata', ...SOURCE_TEXT_NAMES]);

    return finalizeRow(bucket);
  }).filter((row) => Object.keys(row).length > 0);

  return {
    rows,
    prefilledMapping: buildPrefilledMapping(rows, mappingHints)
  };
}
