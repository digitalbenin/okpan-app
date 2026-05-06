/**
 * Linked Art import preset
 *
 * FORMAT RECOGNITION
 * Auto-detection requires format === 'json'. `isLinkedArtShape`
 * (linkedArtHelpers.js) accepts three input shapes:
 *   • A single entity object — must carry a known Linked Art `type` value
 *     (HumanMadeObject, Person, Group, Place, Set, …) and an `id` property.
 *   • An `@graph` container — accepted when at least one graph node has a
 *     recognised Linked Art `type`.
 *   • An array — accepted when at least one element satisfies either rule above.
 *   Additionally, if `@context` exactly matches the canonical Linked Art context
 *   URL the document is accepted unconditionally.
 *
 * PARSING PROCEDURE
 * `extractLinkedArtProjection` (linkedArtHelpers.js) drives the conversion:
 *   1. Collect — `collectEntities` normalises the input to a flat list of entity
 *      objects, unwrapping `@graph` containers and bare arrays.
 *   2. Project — each entity is passed to `projectEntity`, which runs two
 *      complementary passes:
 *        a. Curated aliases (`appendAliases`) — emits a fixed set of clean,
 *           human-readable keys: `id`, `type`, `name.<lang>`, `description.<lang>`,
 *           `biography`, `accession_number`, `material`, `dimension_statement`,
 *           `object_type`, `style`, `nationality`, `collection`, `image_url`,
 *           `homepage_url`, and similar relation fields. Primary names are
 *           preferred over secondary ones; AAT Getty URIs are resolved to labels
 *           and ISO 639-1 language codes.
 *        b. Generic recursive flatten (`flatten`) — walks every non-structural
 *           key not in `SKIP_KEYS`, emitting leaf values at dot-separated paths.
 *           Language context discovered on a node is propagated to its `part`
 *           children. Dimension nodes are collapsed to `"value unit"` strings.
 *           Nodes that have no plain-text value but carry an `access_point` URL
 *           fall back to that URL.
 *   3. Clean-up — `finalizeRow` deduplicates multi-values; bare integer summaries
 *      are removed when child headers already carry the real data.
 *   4. Ontology hints — `getOntologyHint` maps every output header to a
 *      known ontology field name for the import mapping UI.
 *
 * OUTPUT
 * Returns `{ data, tabularized, prefilledMapping, warnings }`:
 *   • `data`            — array of flat row objects (one per Linked Art entity).
 *   • `tabularized`     — always true.
 *   • `prefilledMapping`— each entry carries an `mappedFieldName` ontology hint
 *                         resolved from `FIELD_TO_ONTOLOGY`; the primary column
 *                         is the first `name.*` or `label.*` header, falling
 *                         back to `id`.
 *   • `warnings`        — parsing errors are caught and surfaced here so a
 *                         malformed file never crashes the import pipeline.
 */
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
