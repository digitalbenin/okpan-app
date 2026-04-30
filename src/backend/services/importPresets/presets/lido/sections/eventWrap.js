import {
  appendMappedValue,
  appendResidualTreeValues,
  buildScopedField,
  directChildrenByLocalName,
  extractAllTexts,
  extractAppellationValues,
  extractConceptTerms,
  extractDirectChildValues,
  extractDisplayValues,
  extractPlaceValues,
  matchesAny,
  normalizeText,
  sortNodes,
  uniqueStrings
} from './shared.js';
import { extractIdentifierValues, extractMaterialsByField, extractStructuredDateEntries, hasValues } from './entityExtractors.js';

const PRODUCTION_EVENT_HINTS = [/creation/, /production/, /made/, /manufact/, /design/, /execution/, /built/, /founding/];
const ACQUISITION_EVENT_HINTS = [/acquisition/, /accession/, /purchase/, /gift/, /donation/, /bequest/, /transfer/, /received/, /custody/];
const COLLECTION_EVENT_HINTS = [/collection/, /collecting/, /collected/, /discovery/, /excavat/, /found/, /field/];
const EXHIBITION_EVENT_HINTS = [/exhibition/, /display/, /show/, /loan exhibition/];

const extractEventActorEntries = (eventNode) => directChildrenByLocalName(eventNode, 'eventActor').flatMap((eventActorNode) => {
  const displayValues = uniqueStrings(extractDisplayValues(eventActorNode, ['displayActorInRole']));
  const actorInRoleNodes = directChildrenByLocalName(eventActorNode, 'actorInRole');

  if (!actorInRoleNodes.length) {
    const fallbackEntry = {
      names: displayValues,
      roles: [],
      display: displayValues
    };
    return hasValues(fallbackEntry) ? [fallbackEntry] : [];
  }

  return actorInRoleNodes.map((actorInRoleNode) => {
    const actorNode = directChildrenByLocalName(actorInRoleNode, 'actor')[0];
    const names = actorNode
      ? collectNamesFromActor(actorNode)
      : [];

    return {
      names: uniqueStrings(names.length ? names : displayValues),
      roles: uniqueStrings(directChildrenByLocalName(actorInRoleNode, 'roleActor').flatMap((entry) => extractConceptTerms(entry))),
      display: displayValues
    };
  }).filter(hasValues);
});

const collectNamesFromActor = (actorNode) => directChildrenByLocalName(actorNode, 'nameActorSet').flatMap((entry) => extractAppellationValues(entry));

const extractEventPlaceEntries = (eventNode) => directChildrenByLocalName(eventNode, 'eventPlace').map((eventPlaceNode) => ({
  names: uniqueStrings(extractPlaceValues(eventPlaceNode)),
  display: uniqueStrings(extractDisplayValues(eventPlaceNode, ['displayPlace']))
})).filter(hasValues);

const buildEventField = (eventIndex, ...segments) => buildScopedField(`event_${eventIndex}`, ...segments);

const appendEventField = (bucket, mappingHints, eventIndex, segments, mappedFieldName, values, options = {}) => {
  appendMappedValue(bucket, mappingHints, buildEventField(eventIndex, ...segments), mappedFieldName, values, options);
};

const getEventFallbackField = (classification) => {
  if (classification === 'exhibition') return 'exhibition history';
  if (classification === 'acquisition' || classification === 'collection') return 'provenance';
  return 'event';
};

const getEventDateTargetField = (classification) => {
  if (classification === 'production') return 'date made';
  if (classification === 'acquisition') return 'accession date';
  if (classification === 'collection') return 'date collected';
  return getEventFallbackField(classification);
};

const getEventActorNameTargetField = (classification) => {
  if (classification === 'production') return 'producer';
  if (classification === 'acquisition') return 'prior source';
  return getEventFallbackField(classification);
};

const getEventActorRoleTargetField = (classification) => {
  if (classification === 'acquisition') return 'prior source role';
  return getEventFallbackField(classification);
};

const getEventPlaceTargetField = (classification) => {
  if (classification === 'production') return 'production place';
  if (classification === 'collection') return 'place collected';
  return getEventFallbackField(classification);
};

const getEventMethodTargetField = (classification) => {
  if (classification === 'production') return 'production technique';
  if (classification === 'acquisition') return 'accession method';
  return getEventFallbackField(classification);
};

export const summarizeEvent = (eventSetNode) => {
  const eventNode = directChildrenByLocalName(eventSetNode, 'event')[0] || eventSetNode;
  const actorEntries = extractEventActorEntries(eventNode);
  const dateEntries = extractStructuredDateEntries(directChildrenByLocalName(eventNode, 'eventDate'));
  const placeEntries = extractEventPlaceEntries(eventNode);

  return {
    display: extractDisplayValues(eventSetNode, ['displayEvent']),
    eventIds: extractIdentifierValues(eventNode, ['eventID']),
    eventNames: directChildrenByLocalName(eventNode, 'eventName').flatMap((entry) => {
      const appellations = extractAppellationValues(entry);
      return appellations.length ? appellations : extractAllTexts(entry);
    }),
    typeTerms: extractDirectChildValues(eventNode, 'eventType', extractConceptTerms),
    roleInEventTerms: extractDirectChildValues(eventNode, 'roleInEvent', extractConceptTerms),
    actors: actorEntries,
    dates: dateEntries,
    places: placeEntries,
    methodValues: extractDirectChildValues(eventNode, 'eventMethod', extractConceptTerms),
    cultureValues: extractDirectChildValues(eventNode, 'culture', extractConceptTerms),
    periodTerms: extractDirectChildValues(eventNode, 'periodName', extractConceptTerms),
    descriptionValues: directChildrenByLocalName(eventNode, 'eventDescriptionSet').flatMap((entry) => extractDirectChildValues(entry, 'descriptiveNoteValue')),
    eventMaterials: extractMaterialsByField(eventNode)
  };
};

const classifyEvent = (summary) => {
  const evidence = [...summary.typeTerms, ...summary.roleInEventTerms, ...summary.display];
  if (matchesAny(evidence, PRODUCTION_EVENT_HINTS)) return 'production';
  if (matchesAny(evidence, ACQUISITION_EVENT_HINTS)) return 'acquisition';
  if (matchesAny(evidence, COLLECTION_EVENT_HINTS)) return 'collection';
  if (matchesAny(evidence, EXHIBITION_EVENT_HINTS)) return 'exhibition';
  return 'generic';
};

export const appendEventValues = (bucket, mappingHints, eventWrapNode) => {
  sortNodes(directChildrenByLocalName(eventWrapNode, 'eventSet')).forEach((eventSetNode, eventIndex) => {
    const summary = summarizeEvent(eventSetNode);
    const classification = classifyEvent(summary);
    const eventPath = buildEventField(eventIndex);
    const eventNode = directChildrenByLocalName(eventSetNode, 'event')[0] || eventSetNode;
    const fallbackField = getEventFallbackField(classification);

    appendEventField(bucket, mappingHints, eventIndex, ['classification'], fallbackField, [classification]);
    appendEventField(bucket, mappingHints, eventIndex, ['id'], fallbackField, summary.eventIds);
    appendEventField(bucket, mappingHints, eventIndex, ['name'], fallbackField, summary.eventNames);
    appendEventField(bucket, mappingHints, eventIndex, ['type'], fallbackField, summary.typeTerms);
    appendEventField(bucket, mappingHints, eventIndex, ['display'], fallbackField, summary.display);
    appendEventField(bucket, mappingHints, eventIndex, ['role'], fallbackField, summary.roleInEventTerms);

    summary.actors.forEach((actorEntry, actorIndex) => {
      appendEventField(bucket, mappingHints, eventIndex, [`actor_${actorIndex}`, 'name'], getEventActorNameTargetField(classification), actorEntry.names);
      appendEventField(bucket, mappingHints, eventIndex, [`actor_${actorIndex}`, 'role'], getEventActorRoleTargetField(classification), actorEntry.roles);
      appendEventField(bucket, mappingHints, eventIndex, [`actor_${actorIndex}`, 'display'], fallbackField, actorEntry.display);
    });

    summary.dates.forEach((dateEntry, dateIndex) => {
      const dateTargetField = getEventDateTargetField(classification);
      appendEventField(bucket, mappingHints, eventIndex, [`date_${dateIndex}`, 'value'], dateTargetField, dateEntry.values);
      appendEventField(bucket, mappingHints, eventIndex, [`date_${dateIndex}`, 'display'], dateTargetField, dateEntry.display);
      appendEventField(bucket, mappingHints, eventIndex, [`date_${dateIndex}`, 'start'], dateTargetField, dateEntry.start);
      appendEventField(bucket, mappingHints, eventIndex, [`date_${dateIndex}`, 'end'], dateTargetField, dateEntry.end);
    });

    summary.places.forEach((placeEntry, placeIndex) => {
      const placeTargetField = getEventPlaceTargetField(classification);
      appendEventField(bucket, mappingHints, eventIndex, [`place_${placeIndex}`, 'name'], placeTargetField, placeEntry.names);
      appendEventField(bucket, mappingHints, eventIndex, [`place_${placeIndex}`, 'display'], placeTargetField, placeEntry.display);
    });

    summary.methodValues.forEach((value, methodIndex) => {
      appendEventField(bucket, mappingHints, eventIndex, [`method_${methodIndex}`], getEventMethodTargetField(classification), [value]);
    });

    summary.cultureValues.forEach((value, cultureIndex) => {
      appendEventField(bucket, mappingHints, eventIndex, [`culture_${cultureIndex}`], classification === 'production' ? 'ethnic attribution' : fallbackField, [value]);
    });

    summary.periodTerms.forEach((value, periodIndex) => {
      const targetField = classification === 'production' && /(dynasty|reign)/.test(normalizeText(value))
        ? 'reign associated name'
        : fallbackField;
      appendEventField(bucket, mappingHints, eventIndex, [`period_${periodIndex}`], targetField, [value]);
    });

    summary.descriptionValues.forEach((value, descriptionIndex) => {
      appendEventField(bucket, mappingHints, eventIndex, [`description_${descriptionIndex}`], fallbackField, [value]);
    });

    summary.eventMaterials.material.forEach((value, materialIndex) => {
      appendEventField(bucket, mappingHints, eventIndex, [`material_${materialIndex}`], fallbackField, [value]);
    });

    summary.eventMaterials['production technique'].forEach((value, techniqueIndex) => {
      appendEventField(bucket, mappingHints, eventIndex, [`technique_${techniqueIndex}`], classification === 'production' ? 'production technique' : fallbackField, [value]);
    });

    appendResidualTreeValues(bucket, mappingHints, eventSetNode, `${eventPath}.raw`, fallbackField, ['displayEvent', 'event']);
    appendResidualTreeValues(bucket, mappingHints, eventNode, `${eventPath}.raw`, fallbackField, ['eventID', 'eventName', 'eventType', 'roleInEvent', 'eventActor', 'eventDate', 'eventPlace', 'eventMethod', 'culture', 'periodName', 'eventDescriptionSet', 'eventMaterialsTech']);
  });
};