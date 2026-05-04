import jsonLdPreset from './presets/jsonld/jsonLdPreset.js';
import lidoPreset from './presets/lido/lidoPreset.js';
import linkedArtPreset from './presets/linkedArt/linkedArtPreset.js';

// linkedArtPreset is listed before jsonLdPreset so it wins auto-detection for Linked Art data
const PRESETS = [lidoPreset, linkedArtPreset, jsonLdPreset];

function sanitizePresetMeta(preset) {
  return {
    id: preset.id,
    label: preset.label,
    description: preset.description
  };
}

export function listPresetsForFormat(format) {
  return PRESETS
    .filter((preset) => preset.supportedFormats?.includes(format))
    .map(sanitizePresetMeta);
}

export function detectImportPreset(parsedResult) {
  const format = parsedResult?.format;
  if (!format) {
    return null;
  }

  const preset = PRESETS.find((entry) => {
    if (!entry.supportedFormats?.includes(format)) return false;
    return entry.canAutoDetect?.(parsedResult) === true;
  });

  return preset ? sanitizePresetMeta(preset) : null;
}

export function describeImportPresets(parsedResult) {
  return {
    ...parsedResult,
    sourceData: parsedResult?.data,
    detectedPreset: detectImportPreset(parsedResult),
    availablePresets: listPresetsForFormat(parsedResult?.format),
    preset: null,
    prefilledMapping: [],
    parserWarnings: [],
    tabularized: false
  };
}

export async function applyImportPreset(parsedResult, { selectedPreset } = {}) {
  if (!selectedPreset) {
    return describeImportPresets(parsedResult);
  }

  const preset = PRESETS.find((entry) => entry.id === selectedPreset);

  if (!preset) {
    throw new Error(`Unknown import preset: ${selectedPreset}`);
  }

  if (!preset.supportedFormats?.includes(parsedResult?.format)) {
    throw new Error(`Preset '${selectedPreset}' does not support ${parsedResult?.format} files`);
  }

  const presetOutput = await preset.parse(parsedResult) || {};

  return {
    ...parsedResult,
    sourceData: parsedResult?.data,
    ...('data' in presetOutput ? { data: presetOutput.data } : {}),
    tabularized: Boolean(presetOutput.tabularized),
    prefilledMapping: Array.isArray(presetOutput.prefilledMapping) ? presetOutput.prefilledMapping : [],
    parserWarnings: Array.isArray(presetOutput.warnings) ? presetOutput.warnings : [],
    preset: sanitizePresetMeta(preset),
    detectedPreset: sanitizePresetMeta(preset),
    availablePresets: listPresetsForFormat(parsedResult?.format)
  };
}