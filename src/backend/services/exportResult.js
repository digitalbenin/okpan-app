export function buildCounts({
  objects = [],
  assets = [],
  ontologyFields = [],
  datasources = [],
  templates = [],
  researchFields = [],
  vocabularies = [],
  vga = [],
  genericAssets = [],
} = {}) {
  return {
    objects: objects.length,
    assets: assets.length,
    ontology_fields: ontologyFields.length,
    datasources: datasources.length,
    templates: templates.length,
    research_fields: researchFields.length,
    vocabularies: vocabularies.length,
    vocabularies_generic_assets: vga.length,
    generic_assets: genericAssets.length,
  };
}

export function makeExportResult({ filePath, zipped, counts, fallbackMode }) {
  return { filePath, mode: zipped ? 'zip' : fallbackMode, counts };
}
