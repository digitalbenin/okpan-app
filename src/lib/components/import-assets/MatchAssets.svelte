<script>
  import { resource } from "runed";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  const matchingSuggestions = resource(
    () => wizard.assets,
    async (assets, preAssets, { data, refetching, onCleanup, signal }) => {
      if (!assets.length) {
        return [];
      }
      const toMap = assets.map((a) => ({ id: a.id, filename: a.filename }));
      const suggestions = await window.api.suggestObjectMatches(toMap, {
        institutionId: wizard.institutionId,
        searchFields: [],
        maxSuggestions: 3,
        minConfidence: 0.3,
      });
      console.log("Received suggestions", suggestions);
      return suggestions;
    },
    { initialValue: [] }
  );

  $inspect(matchingSuggestions);
</script>
