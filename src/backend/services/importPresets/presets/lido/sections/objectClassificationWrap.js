import {
  appendResidualTreeValues,
  appendScopedField,
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractConceptTerms,
  getAttribute,
  sortNodes
} from './shared.js';

export const appendObjectClassificationValues = (bucket, mappingHints, classificationWrapNode) => {
  directChildrenByLocalName(classificationWrapNode, 'objectWorkTypeWrap').forEach((objectWorkTypeWrapNode) => {
    sortNodes(collectDescendantsByLocalName(objectWorkTypeWrapNode, 'objectWorkType')).forEach((entry, index) => {
      appendScopedField(bucket, mappingHints, 'object_classification', [`object_work_type_${index}`, 'term'], 'object type', extractConceptTerms(entry));
      appendScopedField(bucket, mappingHints, 'object_classification', [`object_work_type_${index}`, 'type'], 'object type', [getAttribute(entry, 'type')]);
    });
  });

  directChildrenByLocalName(classificationWrapNode, 'classificationWrap').forEach((classificationNodeWrap) => {
    sortNodes(collectDescendantsByLocalName(classificationNodeWrap, 'classification')).forEach((entry, index) => {
      appendScopedField(bucket, mappingHints, 'object_classification', [`classification_${index}`, 'term'], 'object type', extractConceptTerms(entry));
      appendScopedField(bucket, mappingHints, 'object_classification', [`classification_${index}`, 'type'], 'object type', [getAttribute(entry, 'type')]);
    });
  });

  appendResidualTreeValues(bucket, mappingHints, classificationWrapNode, 'object_classification.raw', null, ['objectWorkTypeWrap', 'classificationWrap']);
};