import { appendRightsValues } from './rightsSection.js';
import {
  appendResidualTreeValues,
  appendScopedField,
  directChildrenByLocalName,
  extractAllTexts,
  extractConceptTerms,
  extractDirectChildValues,
  getAttribute,
  looksLikeUrl,
  sortNodes
} from './shared.js';
import { appendLegalBodyEntriesToScope, appendObjectEntriesToScope, extractIdentifierValues, extractLegalBodyEntries, extractObjectSetEntries } from './entityExtractors.js';

export const appendRecordWrapValues = (bucket, mappingHints, recordWrapNode) => {
  appendScopedField(bucket, mappingHints, 'record', ['id'], 'object id', extractIdentifierValues(recordWrapNode, ['recordID']));
  appendScopedField(bucket, mappingHints, 'record', ['type'], null, extractDirectChildValues(recordWrapNode, 'recordType', extractConceptTerms));
  appendLegalBodyEntriesToScope(bucket, mappingHints, 'record.source', extractLegalBodyEntries(directChildrenByLocalName(recordWrapNode, 'recordSource')));
  appendRightsValues(bucket, mappingHints, directChildrenByLocalName(recordWrapNode, 'recordRights'), 'record.right');
  appendObjectEntriesToScope(bucket, mappingHints, 'record.collection', extractObjectSetEntries(directChildrenByLocalName(recordWrapNode, 'collection')), 'department and institution');

  sortNodes(directChildrenByLocalName(recordWrapNode, 'recordInfoSet')).forEach((recordInfoSetNode, recordInfoIndex) => {
    const infoScope = `record.info_${recordInfoIndex}`;
    appendScopedField(bucket, mappingHints, infoScope, ['id'], 'weblink', extractIdentifierValues(recordInfoSetNode, ['recordInfoID']));
    appendScopedField(bucket, mappingHints, infoScope, ['link'], 'weblink', extractDirectChildValues(recordInfoSetNode, 'recordInfoLink').filter((value) => looksLikeUrl(value)));
    appendScopedField(bucket, mappingHints, infoScope, ['type'], 'weblink', [getAttribute(recordInfoSetNode, 'type')]);
    directChildrenByLocalName(recordInfoSetNode, 'recordMetadataDate').forEach((entry, dateIndex) => {
      appendScopedField(bucket, mappingHints, infoScope, [`metadata_date_${dateIndex}`], 'notes', extractAllTexts(entry));
    });
    appendResidualTreeValues(bucket, mappingHints, recordInfoSetNode, `${infoScope}.raw`, null, ['recordInfoID', 'recordInfoLink', 'recordMetadataDate']);
  });

  appendResidualTreeValues(bucket, mappingHints, recordWrapNode, 'record.raw', null, ['recordID', 'recordSource', 'recordInfoSet', 'recordType', 'collection', 'recordRights']);
};