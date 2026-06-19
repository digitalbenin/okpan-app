<script>
  import InfoBox from "$lib/components/projects/InfoBox.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    fieldName = "",
    onClose = undefined,
  } = $props();

  const { t } = getTranslationStore();

  const helpContent = $derived.by(() => {
    if (fieldName === "name") {
      return {
        title: t("objects:help.name_title"),
        description: t("objects:help.name_description"),
        example: t("objects:help.name_example"),
        tip: t("objects:help.name_tip"),
      };
    }
    return null;
  });
</script>

{#if helpContent}
  <InfoBox
    title={helpContent.title}
    description={helpContent.description}
    example={helpContent.example}
    tip={helpContent.tip}
    closeable={true}
    paddingClass="p-1"
    border={false}
    {onClose}
  />
{/if}
