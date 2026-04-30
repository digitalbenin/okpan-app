import {
  appendResidualTreeValues,
  appendScopedField,
  classifyRightsTarget,
  directChildrenByLocalName,
  extractAllTexts,
  extractConceptTerms,
  sortNodes
} from './shared.js';
import { appendDateEntriesToScope, appendLegalBodyEntriesToScope, extractLegalBodyEntries, extractStructuredDateEntries } from './entityExtractors.js';

export const appendRightsValues = (bucket, mappingHints, rightsNodes, scopePrefix) => {
  sortNodes(rightsNodes).forEach((rightsNode, rightsIndex) => {
    const rightsScope = `${scopePrefix}_${rightsIndex}`;

    directChildrenByLocalName(rightsNode, 'rightsType').forEach((rightsTypeNode) => {
      const values = extractConceptTerms(rightsTypeNode);
      const targetField = classifyRightsTarget(values) || 'legal status';
      appendScopedField(bucket, mappingHints, rightsScope, ['type'], targetField, values);
    });

    appendDateEntriesToScope(bucket, mappingHints, rightsScope, 'date', extractStructuredDateEntries(directChildrenByLocalName(rightsNode, 'rightsDate'), []), 'legal status');
    appendLegalBodyEntriesToScope(bucket, mappingHints, `${rightsScope}.holder`, extractLegalBodyEntries(directChildrenByLocalName(rightsNode, 'rightsHolder')));

    directChildrenByLocalName(rightsNode, 'creditLine').forEach((entry, creditLineIndex) => {
      appendScopedField(bucket, mappingHints, rightsScope, [`credit_line_${creditLineIndex}`], 'notes', extractAllTexts(entry));
    });

    appendResidualTreeValues(bucket, mappingHints, rightsNode, `${rightsScope}.raw`, null, ['rightsType', 'rightsDate', 'rightsHolder', 'creditLine']);
  });
};