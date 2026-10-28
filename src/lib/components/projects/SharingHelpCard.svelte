<script>
  import { IconBulb } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();
</script>

<div class="bg-white border rounded-3 p-4 d-flex flex-column">
  <div class="d-flex flex-column gap-1">
    <div class="flex-shrink-0">
      <IconBulb size={16} stroke={2} />
    </div>
    <div>
      <p class="fw-semibold mb-1 text-body">{t("share-project.help-title", { fallback: "Sharing?" })}</p>
      <div class="text-body-secondary fs-7">
        <p class="mb-3">{t("share-project.help-desc-p1", { fallback: "Here you can configure sharing settings for your project. Multi user projects can be accessed by multiple collaborators simultaneously and are required for real-time collaboration features." })}</p>
        <p class="mb-0">{t("share-project.help-desc-p2", { fallback: "Private projects are only accessible on this device and do not support real-time collaboration." })}</p>
      </div>
    </div>
  </div>
</div>
