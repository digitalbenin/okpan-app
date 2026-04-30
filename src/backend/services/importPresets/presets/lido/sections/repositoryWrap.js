import {
  appendResidualTreeValues,
  appendScopedField,
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractDisplayValues,
  getAttribute,
  normalizeText,
  sortNodes
} from './shared.js';
import { appendLegalBodyEntriesToScope, appendPlaceEntriesToScope, extractIdentifierValues, extractLegalBodyEntries, extractPlaceSetEntries } from './entityExtractors.js';

export const appendRepositoryValues = (bucket, mappingHints, repositoryWrapNode, scopePrefix = 'repository') => {
  sortNodes(collectDescendantsByLocalName(repositoryWrapNode, 'repositorySet')).forEach((repositorySetNode, repositoryIndex) => {
    const repositoryScope = `${scopePrefix}_${repositoryIndex}`;
    const typeHint = normalizeText(getAttribute(repositorySetNode, 'type'));
    const targetField = /former|previous|prior/.test(typeHint) ? 'provenance' : 'department and institution';

    appendScopedField(bucket, mappingHints, repositoryScope, ['type'], targetField, [typeHint]);
    appendScopedField(bucket, mappingHints, repositoryScope, ['display'], targetField, extractDisplayValues(repositorySetNode, ['displayRepository']));

    extractIdentifierValues(repositorySetNode, ['workID']).forEach((value, workIdIndex) => {
      appendScopedField(bucket, mappingHints, repositoryScope, [`work_id_${workIdIndex}`], 'object id', [value]);
    });

    appendLegalBodyEntriesToScope(bucket, mappingHints, `${repositoryScope}.name`, extractLegalBodyEntries(directChildrenByLocalName(repositorySetNode, 'repositoryName')), targetField);
    appendPlaceEntriesToScope(bucket, mappingHints, `${repositoryScope}.location`, extractPlaceSetEntries(directChildrenByLocalName(repositorySetNode, 'repositoryLocation'), []), targetField);
    appendResidualTreeValues(bucket, mappingHints, repositorySetNode, `${repositoryScope}.raw`, targetField, ['workID', 'displayRepository', 'repositoryName', 'repositoryLocation']);
  });
};