import { appendRightsValues } from './rightsSection.js';
import {
  appendResidualTreeValues,
  appendScopedField,
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractAllTexts,
  extractConceptTerms,
  extractDirectChildValues,
  getAttribute,
  looksLikeUrl,
  matchesAny,
  sortNodes
} from './shared.js';
import { appendDateEntriesToScope, appendLegalBodyEntriesToScope, extractIdentifierValues, extractLegalBodyEntries, extractStructuredDateEntries } from './entityExtractors.js';

const IMAGE_HINTS = [/image/, /photo/, /photograph/, /thumbnail/, /preview/, /jpg/, /jpeg/, /png/, /tiff/, /iiif/];

export const appendResourceValues = (bucket, mappingHints, resourceWrapNode) => {
  sortNodes(collectDescendantsByLocalName(resourceWrapNode, 'resourceSet')).forEach((resourceSetNode, resourceIndex) => {
    const resourceScope = `resource_${resourceIndex}`;
    const resourceTypeValues = extractDirectChildValues(resourceSetNode, 'resourceType', extractConceptTerms);
    const resourceRelTypeValues = extractDirectChildValues(resourceSetNode, 'resourceRelType', extractConceptTerms);
    const perspectiveValues = extractDirectChildValues(resourceSetNode, 'resourcePerspective', extractConceptTerms);

    appendScopedField(bucket, mappingHints, resourceScope, ['id'], 'images', extractIdentifierValues(resourceSetNode, ['resourceID']));
    appendScopedField(bucket, mappingHints, resourceScope, ['type'], 'images', resourceTypeValues);
    appendScopedField(bucket, mappingHints, resourceScope, ['relationship_type'], 'images', resourceRelTypeValues);
    appendScopedField(bucket, mappingHints, resourceScope, ['perspective'], 'images', perspectiveValues);

    directChildrenByLocalName(resourceSetNode, 'resourceDescription').forEach((entry, descriptionIndex) => {
      appendScopedField(bucket, mappingHints, resourceScope, [`description_${descriptionIndex}`], 'notes', extractAllTexts(entry));
    });

    appendDateEntriesToScope(bucket, mappingHints, resourceScope, 'date_taken', extractStructuredDateEntries(directChildrenByLocalName(resourceSetNode, 'resourceDateTaken')), 'images');
    appendLegalBodyEntriesToScope(bucket, mappingHints, `${resourceScope}.source`, extractLegalBodyEntries(directChildrenByLocalName(resourceSetNode, 'resourceSource')));
    appendRightsValues(bucket, mappingHints, directChildrenByLocalName(resourceSetNode, 'rightsResource'), `${resourceScope}.right`);

    sortNodes(directChildrenByLocalName(resourceSetNode, 'resourceRepresentation')).forEach((representationNode, representationIndex) => {
      const representationScope = `${resourceScope}.representation_${representationIndex}`;
      appendScopedField(bucket, mappingHints, representationScope, ['type'], 'images', [getAttribute(representationNode, 'type')]);
      directChildrenByLocalName(representationNode, 'linkResource').forEach((linkNode, linkIndex) => {
        const links = extractAllTexts(linkNode).filter((value) => looksLikeUrl(value));
        const evidence = [...resourceTypeValues, ...resourceRelTypeValues, getAttribute(linkNode, 'formatResource')];
        const targetField = matchesAny(evidence, IMAGE_HINTS) ? 'images' : 'weblink';
        appendScopedField(bucket, mappingHints, representationScope, [`link_${linkIndex}`], targetField, links);
        appendScopedField(bucket, mappingHints, representationScope, [`link_${linkIndex}_format`], targetField, [getAttribute(linkNode, 'formatResource')]);
      });
      appendResidualTreeValues(bucket, mappingHints, representationNode, `${representationScope}.raw`, null, ['linkResource', 'resourceMeasurementsSet']);
    });

    appendResidualTreeValues(bucket, mappingHints, resourceSetNode, `${resourceScope}.raw`, null, ['resourceID', 'resourceRepresentation', 'resourceType', 'resourceRelType', 'resourcePerspective', 'resourceDescription', 'resourceDateTaken', 'resourceSource', 'rightsResource']);
  });
};