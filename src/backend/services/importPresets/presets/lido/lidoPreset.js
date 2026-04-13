import { extractLidoProjection, isLidoDocument } from './lidoHelpers.js';

const lidoPreset = {
  id: 'lido',
  label: 'LIDO',
  description: 'Flattens LIDO XML records into source-path import rows while preserving ontology mapping hints.',
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
      warnings: [
        'LIDO projection applied: preserved distinct source paths as import columns and attached ontology mapping hints for matching.'
      ]
    };
  }
};

export default lidoPreset;