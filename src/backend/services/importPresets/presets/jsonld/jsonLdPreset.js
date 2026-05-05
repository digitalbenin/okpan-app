import { extractJsonLdProjection, isJsonLdShape } from './jsonLdTriples.js';

const jsonLdPreset = {
  id: 'json-ld',
  label: 'JSON-LD',
  description: 'Builds subject-centered import rows from raw JSON-LD structure without ontology-specific field guesses.',
  supportedFormats: ['json'],

  canAutoDetect({ format, data }) {
    if (format !== 'json') return false;
    return isJsonLdShape(data);
  },

  // Projects JSON-LD subjects into flat rows; returns an empty-data result if nothing was extracted
  // and wraps all parsing in an error boundary so a malformed file surfaces as a warning rather than a crash
  parse({ data }) {
    try {
      const { rows, prefilledMapping, warnings } = extractJsonLdProjection(data);

      if (!rows.length) {
        return {
          data: [],
          tabularized: true,
          prefilledMapping: [],
          warnings: ['No JSON-LD subjects were projected into import rows.', ...warnings]
        };
      }

      return {
        data: rows,
        tabularized: true,
        prefilledMapping,
        warnings: [
          'JSON-LD parser applied: raw subject-predicate-object structure was projected into subject-centered import rows.',
          ...warnings
        ]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown JSON-LD parsing error';

      return {
        data: [],
        tabularized: true,
        prefilledMapping: [],
        warnings: [`JSON-LD parser failed: ${message}`]
      };
    }
  }
};

export default jsonLdPreset;