import { extractLinkedArtProjection, isLinkedArtShape } from './linkedArtHelpers.js';

const linkedArtPreset = {
  id: 'linked-art',
  label: 'Linked Art',
  description:
    'Projects Linked Art JSON-LD records into curated import fields with ontology-aware field guesses for objects, people, groups, places, sets, events, and concepts.',
  supportedFormats: ['json'],

  canAutoDetect({ format, data }) {
    if (format !== 'json') return false;
    return isLinkedArtShape(data);
  },

  parse({ data }) {
    try {
      const { rows, prefilledMapping, warnings } = extractLinkedArtProjection(data);

      if (!rows.length) {
        return {
          data: [],
          tabularized: true,
          prefilledMapping: [],
          warnings: ['No Linked Art entities were found in the data.', ...warnings],
        };
      }

      return {
        data: rows,
        tabularized: true,
        prefilledMapping,
        warnings: [
          'Linked Art parser applied: entities were projected into ontology-aware import fields.',
          ...warnings,
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Linked Art parsing error';

      return {
        data: [],
        tabularized: true,
        prefilledMapping: [],
        warnings: [`Linked Art parser failed: ${message}`],
      };
    }
  },
};

export default linkedArtPreset;
