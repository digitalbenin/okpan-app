import { resource, watch } from "runed";
import { suggestFieldMappings, suggestTemplateReuse } from "$lib/api/ImportApi.js";

export function createMatchingPreview(wizard, getFields) {
  const templateSuggestions = resource(
    () => [getFields(), wizard.data, wizard.useMatchingSuggestions || wizard.useMatchingTemplate],
    async ([fields, source, hasDecision], _previous, { signal }) => {
      if (hasDecision || !fields.length) return [];

      const response = await wizard.getMatchingRequest("templates", () =>
        suggestTemplateReuse(fields, wizard.projectId)
      );
      const templates = response?.matchingTemplates ?? [];
      if (!signal.aborted && wizard.data === source && !templates.length && !wizard.useMatchingTemplate) {
        wizard.useMatchingSuggestions = true;
      }
      return templates;
    },
    { initialValue: [] }
  );

  const matchingSuggestions = resource(
    () => [getFields(), wizard.data, wizard.useMatchingSuggestions && !wizard.useMatchingTemplate],
    async ([fields, source, useSuggestions], _previous, { signal }) => {
      if (!useSuggestions || !fields.length) return [];

      const suggestions = await wizard.getMatchingRequest("fields", async () => {
        const alreadyMapped = new Set(wizard.mapping.filter((entry) => entry.mappedField).map((entry) => entry.headerField));
        const toSuggest = fields.filter((field) => !alreadyMapped.has(field));
        if (!toSuggest.length) return [];
        const response = await suggestFieldMappings(toSuggest, { projectId: wizard.projectId });
        return Array.isArray(response) ? response : [];
      });
      if (!signal.aborted && wizard.data === source && !wizard.useMatchingTemplate) {
        wizard.initializeFieldMappings(fields, suggestions);
      }
      return suggestions;
    },
    { initialValue: [] }
  );

  const ready = $derived(wizard.useMatchingTemplate || wizard.fieldMappingsInitialized);
  const allIncluded = $derived(getFields().length > 0 && getFields().every(wizard.isFieldIncluded));
  const mixedInclusion = $derived(!allIncluded && getFields().some(wizard.isFieldIncluded));
  const mappedCount = $derived(new Set(wizard.mapping.filter((entry) => entry.mappedField).map((entry) => entry.headerField)).size);

  watch(() => ready && wizard.mapping.length > 0, (enabled) => {
    wizard.nextEnabled = enabled;
  });

  return {
    templateSuggestions,
    matchingSuggestions,
    get ready() { return ready; },
    get allIncluded() { return allIncluded; },
    get mixedInclusion() { return mixedInclusion; },
    get mappedCount() { return mappedCount; },
    get mappedPercent() {
      const count = getFields().length;
      return count ? Math.round((mappedCount / count) * 100) : 0;
    },
    toggleAll() {
      const include = !allIncluded;
      for (const field of getFields()) wizard.setFieldIncluded(field, include);
    },
  };
}
