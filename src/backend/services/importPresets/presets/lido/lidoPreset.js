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