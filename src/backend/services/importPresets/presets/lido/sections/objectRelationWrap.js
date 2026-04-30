import { summarizeEvent } from './eventWrap.js';
import {
  BIBLIOGRAPHY_HINTS,
  appendResidualTreeValues,
  appendScopedField,
  buildScopedField,
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractAllTexts,
  extractAppellationValues,
  extractConceptTerms,
  extractDescendantValues,
  extractDirectChildValues,
  extractDisplayValues,
  getAttribute,
  matchesAny,
  sortNodes
} from './shared.js';
import {
  appendDateEntriesToScope,
  appendObjectEntriesToScope,
  appendPlaceEntriesToScope,
  extractObjectSetEntries,
  extractPlaceSetEntries,
  extractStructuredDateEntries
} from './entityExtractors.js';

const appendSubjectValues = (bucket, mappingHints, subjectWrapNode) => {
  sortNodes(collectDescendantsByLocalName(subjectWrapNode, 'subjectSet')).forEach((subjectSetNode, subjectSetIndex) => {
    const subjectScope = `subject_${subjectSetIndex}`;
    appendScopedField(bucket, mappingHints, subjectScope, ['display'], 'iconography', extractDisplayValues(subjectSetNode, ['displaySubject']));

    directChildrenByLocalName(subjectSetNode, 'subject').forEach((subjectNode, subjectIndex) => {
      const subjectPartScope = buildScopedField(subjectScope, `part_${subjectIndex}`);
      appendScopedField(bucket, mappingHints, subjectPartScope, ['type'], 'iconography', [getAttribute(subjectNode, 'type')]);
      appendScopedField(bucket, mappingHints, subjectPartScope, ['extent'], 'iconography', extractDirectChildValues(subjectNode, 'extentSubject'));

      directChildrenByLocalName(subjectNode, 'subjectConcept').forEach((entry, conceptIndex) => {
        appendScopedField(bucket, mappingHints, subjectPartScope, [`concept_${conceptIndex}`, 'term'], 'iconography', extractConceptTerms(entry));
      });

      directChildrenByLocalName(subjectNode, 'subjectActor').forEach((entry, actorIndex) => {
        const actorScope = buildScopedField(subjectPartScope, `actor_${actorIndex}`);
        appendScopedField(bucket, mappingHints, actorScope, ['display'], 'iconography', extractDisplayValues(entry, ['displayActor']));
        appendScopedField(bucket, mappingHints, actorScope, ['name'], 'iconography', extractDescendantValues(entry, 'nameActorSet', extractAppellationValues));
      });

      appendDateEntriesToScope(bucket, mappingHints, subjectPartScope, 'date', extractStructuredDateEntries(directChildrenByLocalName(subjectNode, 'subjectDate')), 'iconography');
      appendPlaceEntriesToScope(bucket, mappingHints, `${subjectPartScope}.place`, extractPlaceSetEntries(directChildrenByLocalName(subjectNode, 'subjectPlace')), 'iconography');
      appendObjectEntriesToScope(bucket, mappingHints, `${subjectPartScope}.object`, extractObjectSetEntries(directChildrenByLocalName(subjectNode, 'subjectObject')), 'iconography');

      directChildrenByLocalName(subjectNode, 'subjectEvent').forEach((entry, eventIndex) => {
        const summary = summarizeEvent(entry);
        const eventScope = buildScopedField(subjectPartScope, `event_${eventIndex}`);
        appendScopedField(bucket, mappingHints, eventScope, ['display'], 'iconography', summary.display);
        appendScopedField(bucket, mappingHints, eventScope, ['type'], 'iconography', summary.typeTerms);
        appendScopedField(bucket, mappingHints, eventScope, ['name'], 'iconography', summary.eventNames);
        appendDateEntriesToScope(bucket, mappingHints, eventScope, 'date', summary.dates, 'iconography');
        appendPlaceEntriesToScope(bucket, mappingHints, `${eventScope}.place`, summary.places, 'iconography');
      });

      appendResidualTreeValues(bucket, mappingHints, subjectNode, `${subjectPartScope}.raw`, 'iconography', ['extentSubject', 'subjectConcept', 'subjectActor', 'subjectDate', 'subjectEvent', 'subjectPlace', 'subjectObject']);
    });

    appendResidualTreeValues(bucket, mappingHints, subjectSetNode, `${subjectScope}.raw`, 'iconography', ['displaySubject', 'subject']);
  });
};

const appendRelatedWorksValues = (bucket, mappingHints, relatedWorksWrapNode) => {
  sortNodes(collectDescendantsByLocalName(relatedWorksWrapNode, 'relatedWorkSet')).forEach((relatedWorkSetNode, relatedWorkIndex) => {
    const relatedWorkScope = `related_work_${relatedWorkIndex}`;
    const relationTerms = directChildrenByLocalName(relatedWorkSetNode, 'relatedWorkRelType').flatMap((entry) => extractConceptTerms(entry));
    const displayValues = extractDisplayValues(relatedWorkSetNode, ['displayRelatedWork']);
    const objectEntries = extractObjectSetEntries(directChildrenByLocalName(relatedWorkSetNode, 'relatedWork'));
    const targetField = matchesAny([...relationTerms, ...displayValues, ...objectEntries.flatMap((entry) => entry.names)], BIBLIOGRAPHY_HINTS) ? 'bibliography' : 'notes';

    appendScopedField(bucket, mappingHints, relatedWorkScope, ['display'], targetField, displayValues);
    appendScopedField(bucket, mappingHints, relatedWorkScope, ['relationship_type'], targetField, relationTerms);
    appendObjectEntriesToScope(bucket, mappingHints, `${relatedWorkScope}.object`, objectEntries, targetField);

    directChildrenByLocalName(relatedWorkSetNode, 'sourceRelatedWorkSet').forEach((entry, sourceIndex) => {
      appendScopedField(bucket, mappingHints, relatedWorkScope, [`source_${sourceIndex}`], targetField, extractAllTexts(entry));
    });

    appendResidualTreeValues(bucket, mappingHints, relatedWorkSetNode, `${relatedWorkScope}.raw`, targetField, ['displayRelatedWork', 'relatedWorkRelType', 'relatedWork', 'sourceRelatedWorkSet']);
  });
};

export const appendObjectRelationValues = (bucket, mappingHints, relationWrapNode) => {
  const subjectWrap = directChildrenByLocalName(relationWrapNode, 'subjectWrap')[0];
  if (subjectWrap) {
    appendSubjectValues(bucket, mappingHints, subjectWrap);
  }

  const relatedWorksWrap = directChildrenByLocalName(relationWrapNode, 'relatedWorksWrap')[0];
  if (relatedWorksWrap) {
    appendRelatedWorksValues(bucket, mappingHints, relatedWorksWrap);
  }

  appendResidualTreeValues(bucket, mappingHints, relationWrapNode, 'object_relation.raw', null, ['subjectWrap', 'relatedWorksWrap']);
};