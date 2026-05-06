/**
 * LIDO XML import preset
 *
 * FORMAT RECOGNITION
 * Auto-detection requires format === 'xml'. `isLidoDocument` (lidoHelpers.js)
 * then searches the already-parsed JS object for at least one node whose local
 * element name is `lido` (via `extractLidoNodes`) or for any `lidoWrap`
 * descendant. The check is namespace-agnostic — namespace prefixes are stripped
 * before comparison.
 *
 * PARSING PROCEDURE
 * `extractLidoProjection` (lidoHelpers.js) drives the conversion:
 *   1. Collect — `extractLidoNodes` gathers every `<lido>` element from the
 *      document; each one produces exactly one output row.
 *   2. Project — for each `<lido>` node a bucket object is built by delegating
 *      to specialised section modules in order:
 *        • `appendObjectIdentificationValues`  — titles, descriptions, measurements,
 *          materials, inscriptions, repository, rights.
 *        • `appendObjectClassificationValues`  — object/work types, subjects.
 *        • `appendEventValues`                 — production, acquisition, and other
 *          events with actors, dates, places, and techniques.
 *        • `appendObjectRelationValues`        — related works and subjects.
 *        • `appendAdministrativeMetadataValues`— record metadata, resources
 *          (images), and rights statements.
 *        • `appendBibliographySources`         — top-level `source*` text nodes.
 *        • `appendResidualTreeValues`          — any remaining unrecognised nodes
 *          are emitted under `lido.raw.*` so no data is silently lost.
 *   3. Fields — every bucket entry is placed via `appendScopedField`, which
 *      builds dot-separated headers and accumulates ontology mapping hints.
 *      `finalizeRow` converts single-element arrays to plain strings.
 *
 * OUTPUT
 * Returns `{ data, tabularized, prefilledMapping, warnings }`:
 *   • `data`            — array of flat row objects (one per `<lido>` element).
 *   • `tabularized`     — always true.
 *   • `prefilledMapping`— built from the mapping hints accumulated during
 *                         projection; each entry carries an ontology field
 *                         suggestion and a `primary` flag for the record id.
 *   • `warnings`        — a single informational message when records are found;
 *                         a "no records" warning when the document is empty.
 */
import { extractLidoProjection, isLidoDocument } from './lidoHelpers.js';

const lidoPreset = {
  id: 'lido',
  label: 'LIDO',
  description: 'Projects LIDO XML records into schema-based import fields with opinionated ontology mapping hints.',
  supportedFormats: ['xml'],

  canAutoDetect({ format, data }) {
    if (format !== 'xml') return false;
    return isLidoDocument(data);
  },

  parse({ data }) {
    const { rows, prefilledMapping } = extractLidoProjection(data);

    if (!rows.length) {
      return {
        data: [],
        tabularized: true,
        prefilledMapping: [],
        warnings: ['No LIDO object records were found in the XML file.']
      };
    }

    return {
      data: rows,
      tabularized: true,
      prefilledMapping,
      warnings: ['LIDO parser applied: records were projected from core LIDO sections into curated import fields.']
    };
  }
};

export default lidoPreset;