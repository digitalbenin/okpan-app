import { appendRecordWrapValues } from './recordWrap.js';
import { appendResourceValues } from './resourceWrap.js';
import { appendRightsValues } from './rightsSection.js';
import { appendResidualTreeValues, directChildrenByLocalName } from './shared.js';

export const appendAdministrativeMetadataValues = (bucket, mappingHints, administrativeMetadataNode) => {
  directChildrenByLocalName(administrativeMetadataNode, 'rightsWorkWrap').forEach((rightsWrapNode) => {
    appendRightsValues(bucket, mappingHints, directChildrenByLocalName(rightsWrapNode, 'rightsWorkSet'), 'rights_work');
  });

  directChildrenByLocalName(administrativeMetadataNode, 'recordWrap').forEach((recordWrapNode) => {
    appendRecordWrapValues(bucket, mappingHints, recordWrapNode);
  });

  directChildrenByLocalName(administrativeMetadataNode, 'resourceWrap').forEach((resourceWrapNode) => {
    appendResourceValues(bucket, mappingHints, resourceWrapNode);
  });

  appendResidualTreeValues(bucket, mappingHints, administrativeMetadataNode, 'administrative_metadata.raw', null, ['rightsWorkWrap', 'recordWrap', 'resourceWrap']);
};