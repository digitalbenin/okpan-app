import { appendRightsValues } from './rightsSection.js';
import { appendRepositoryValues } from './repositoryWrap.js';
import {
  appendResidualTreeValues,
  appendScopedField,
  collectDescendantsByLocalName,
  directChildrenByLocalName,
  extractAllTexts,
  extractAppellationValues,
  extractConceptTerms,
  extractDisplayValues,
  extractDescendantValues,
  extractDirectChildValues,
  getAttribute,
  sortNodes
} from './shared.js';
import { extractMaterialsByField, extractMeasurementsByField } from './entityExtractors.js';

export const appendObjectIdentificationValues = (bucket, mappingHints, objectIdentificationWrap) => {
  const identificationScope = 'identification';

  sortNodes(collectDescendantsByLocalName(objectIdentificationWrap, 'titleSet')).forEach((titleSetNode, titleIndex) => {
    appendScopedField(bucket, mappingHints, identificationScope, [`title_${titleIndex}`, 'value'], 'designation', extractAppellationValues(titleSetNode), { primary: titleIndex === 0 });
    appendScopedField(bucket, mappingHints, identificationScope, [`title_${titleIndex}`, 'type'], 'designation', [getAttribute(titleSetNode, 'type')]);
  });

  sortNodes(collectDescendantsByLocalName(objectIdentificationWrap, 'objectDescriptionSet')).forEach((descriptionNode, descriptionIndex) => {
    const descriptionScope = `${identificationScope}.description_${descriptionIndex}`;
    appendScopedField(bucket, mappingHints, descriptionScope, ['value'], 'description', extractDescendantValues(descriptionNode, 'descriptiveNoteValue'));
    appendScopedField(bucket, mappingHints, descriptionScope, ['type'], 'description', [getAttribute(descriptionNode, 'type')]);
    appendRightsValues(bucket, mappingHints, directChildrenByLocalName(descriptionNode, 'objectDescriptionRights'), `${descriptionScope}.right`);
    appendResidualTreeValues(bucket, mappingHints, descriptionNode, `${descriptionScope}.raw`, null, ['descriptiveNoteID', 'descriptiveNoteValue', 'sourceDescriptiveNote', 'objectDescriptionRights']);
  });

  sortNodes(collectDescendantsByLocalName(objectIdentificationWrap, 'inscriptions')).forEach((inscriptionNode, inscriptionIndex) => {
    const inscriptionScope = `${identificationScope}.inscription_${inscriptionIndex}`;
    appendScopedField(bucket, mappingHints, inscriptionScope, ['type'], 'inscriptions', [getAttribute(inscriptionNode, 'type')]);
    appendScopedField(bucket, mappingHints, inscriptionScope, ['transcription'], 'inscriptions', extractDirectChildValues(inscriptionNode, 'inscriptionTranscription'));
    directChildrenByLocalName(inscriptionNode, 'inscriptionDescription').forEach((entry, descriptionIndex) => {
      appendScopedField(bucket, mappingHints, inscriptionScope, [`description_${descriptionIndex}`], 'inscriptions', extractDescendantValues(entry, 'descriptiveNoteValue'));
    });
    appendResidualTreeValues(bucket, mappingHints, inscriptionNode, `${inscriptionScope}.raw`, null, ['inscriptionTranscription', 'inscriptionDescription']);
  });

  const materialsByField = extractMaterialsByField(objectIdentificationWrap);
  materialsByField.material.forEach((value, materialIndex) => {
    appendScopedField(bucket, mappingHints, identificationScope, [`material_${materialIndex}`], 'material', [value]);
  });
  materialsByField['production technique'].forEach((value, techniqueIndex) => {
    appendScopedField(bucket, mappingHints, identificationScope, [`technique_${techniqueIndex}`], 'production technique', [value]);
  });

  const measurementsByField = extractMeasurementsByField(objectIdentificationWrap);
  measurementsByField.dimensions.forEach((value, dimensionIndex) => {
    appendScopedField(bucket, mappingHints, identificationScope, [`dimension_${dimensionIndex}`], 'dimensions', [value]);
  });
  measurementsByField.weight.forEach((value, weightIndex) => {
    appendScopedField(bucket, mappingHints, identificationScope, [`weight_${weightIndex}`], 'weight', [value]);
  });

  directChildrenByLocalName(objectIdentificationWrap, 'displayStateEditionWrap').forEach((entry) => {
    extractDisplayValues(entry, ['displayState']).forEach((value, displayStateIndex) => {
      appendScopedField(bucket, mappingHints, identificationScope, [`display_state_${displayStateIndex}`], 'display status', [value]);
    });
    extractDisplayValues(entry, ['displayEdition']).forEach((value, displayEditionIndex) => {
      appendScopedField(bucket, mappingHints, identificationScope, [`display_edition_${displayEditionIndex}`], 'notes', [value]);
    });
  });

  collectDescendantsByLocalName(objectIdentificationWrap, 'objectNote').forEach((entry, noteIndex) => {
    appendScopedField(bucket, mappingHints, identificationScope, [`note_${noteIndex}`], 'notes', extractAllTexts(entry));
  });

  const repositoryWrap = directChildrenByLocalName(objectIdentificationWrap, 'repositoryWrap')[0];
  if (repositoryWrap) {
    appendRepositoryValues(bucket, mappingHints, repositoryWrap);
  }

  appendResidualTreeValues(bucket, mappingHints, objectIdentificationWrap, `${identificationScope}.raw`, null, ['titleWrap', 'objectDescriptionWrap', 'inscriptionsWrap', 'objectMaterialsTechWrap', 'objectMeasurementsWrap', 'displayStateEditionWrap', 'objectNote', 'repositoryWrap']);
};