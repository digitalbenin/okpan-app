import { appendEventValues } from './eventWrap.js';
import { appendObjectClassificationValues } from './objectClassificationWrap.js';
import { appendObjectIdentificationValues } from './objectIdentificationWrap.js';
import { appendObjectRelationValues } from './objectRelationWrap.js';
import { appendResidualTreeValues, directChildrenByLocalName } from './shared.js';

export const appendDescriptiveMetadataValues = (bucket, mappingHints, descriptiveMetadataNode) => {
  directChildrenByLocalName(descriptiveMetadataNode, 'objectClassificationWrap').forEach((classificationWrapNode) => {
    appendObjectClassificationValues(bucket, mappingHints, classificationWrapNode);
  });

  const identificationWrap = directChildrenByLocalName(descriptiveMetadataNode, 'objectIdentificationWrap')[0];
  if (identificationWrap) {
    appendObjectIdentificationValues(bucket, mappingHints, identificationWrap);
  }

  const eventWrap = directChildrenByLocalName(descriptiveMetadataNode, 'eventWrap')[0];
  if (eventWrap) {
    appendEventValues(bucket, mappingHints, eventWrap);
  }

  directChildrenByLocalName(descriptiveMetadataNode, 'objectRelationWrap').forEach((relationWrapNode) => {
    appendObjectRelationValues(bucket, mappingHints, relationWrapNode);
  });

  appendResidualTreeValues(bucket, mappingHints, descriptiveMetadataNode, 'descriptive_metadata.raw', null, ['objectClassificationWrap', 'objectIdentificationWrap', 'eventWrap', 'objectRelationWrap']);
};