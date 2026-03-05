import jsonLdPreset from './presets/jsonLdPreset.js';

const PRESETS = [
  jsonLdPreset
];

const sanitizePresetMeta = (preset) => ({
  id: preset.id,
  label: preset.label,
  description: preset.description
});

export function listPresetsForFormat(format) {
  return PRESETS
    .filter((preset) => preset.supportedFormats?.includes(format))
    .map(sanitizePresetMeta);
}

export function getPresetById(presetId) {
  return PRESETS.find((preset) => preset.id === presetId) || null;
}

export function applyImportPreset(parsedResult, options = {}) {
  const { selectedPreset } = options;
  const format = parsedResult?.format;
  const availablePresets = listPresetsForFormat(format);

  if (!availablePresets.length) {
    return {
      ...parsedResult,
      preset: null,
      availablePresets,
      prefilledMapping: [],
      parserWarnings: [],
      tabularized: false
    };
  }

  let preset = null;
  let autoDetected = false;

  if (selectedPreset) {
    preset = getPresetById(selectedPreset);
    if (!preset) {
      throw new Error(`Unknown import preset: ${selectedPreset}`);
    }
    if (!preset.supportedFormats?.includes(format)) {
      throw new Error(`Preset '${selectedPreset}' does not support ${format} files`);
    }
  } else {
    preset = PRESETS.find((entry) => {
      if (!entry.supportedFormats?.includes(format)) return false;
      return entry.canAutoDetect?.(parsedResult) === true;
    }) || null;
    autoDetected = Boolean(preset);
  }

  if (!preset) {
    return {
      ...parsedResult,
      preset: null,
      availablePresets,
      prefilledMapping: [],
      parserWarnings: [],
      tabularized: false
    };
  }

  const presetOutput = preset.parse(parsedResult) || {};

  return {
    ...parsedResult,
    ...('data' in presetOutput ? { data: presetOutput.data } : {}),
    tabularized: Boolean(presetOutput.tabularized),
    prefilledMapping: Array.isArray(presetOutput.prefilledMapping) ? presetOutput.prefilledMapping : [],
    parserWarnings: Array.isArray(presetOutput.warnings) ? presetOutput.warnings : [],
    preset: {
      ...sanitizePresetMeta(preset),
      autoDetected
    },
    availablePresets
  };
}
