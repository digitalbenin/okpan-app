<script>
  import { IconInfoCircle, IconPhoto, IconCirclesRelation, IconNotes, IconTable } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { timeAgo } from "$lib/utils/dates.js";

  let {
    object = {},
    activeSection = "basic-info",
    onNavigate = undefined,
  } = $props();

  const { t } = getTranslationStore();

  const createdDate = $derived(object?.created_at ? timeAgo(object.created_at) : null);
  const updatedDate = $derived(object?.updated_at ? timeAgo(object.updated_at) : null);

  const sections = $derived([
    { id: "basic-info", icon: IconInfoCircle, label: t("objects.sidebar.basic_info", { fallback: "Basic info" }) },
    { id: "media", icon: IconPhoto, label: t("objects.sidebar.media", { fallback: "Media" }) },
    { id: "connections", icon: IconCirclesRelation, label: t("objects.sidebar.connections", { fallback: "Object connections" }) },
    { id: "custom-fields", icon: IconNotes, label: t("objects.sidebar.custom_fields", { fallback: "Custom fields" }) },
    { id: "source-data", icon: IconTable, label: t("objects.sidebar.source_data", { fallback: "Source data" }) },
  ]);

  function handleClick(sectionId) {
    onNavigate?.(sectionId);
  }
</script>

<div class="d-flex flex-column gap-5">
  <!-- ABOUT THIS OBJECT section -->
  <div class="d-flex flex-column gap-3">
    <p class="text-uppercase fs-8 fw-normal text-body mb-0" style="letter-spacing: 0.24px;">
      {t("objects.sidebar.about", { fallback: "About this object" })}
    </p>
    <div class="d-flex flex-column">
      {#each sections as section}
        <button
          type="button"
          class="btn btn-link text-decoration-none text-start d-flex align-items-center gap-2 px-2 py-1 border-0 w-100"
          class:bg-body-secondary={activeSection === section.id}
          class:border-start={activeSection === section.id}
          class:border-2={activeSection === section.id}
          class:border-success={activeSection === section.id}
          class:rounded-end-2={activeSection === section.id}
          style="--bs-btn-color: var(--bs-body-color); --bs-btn-hover-color: var(--bs-body-color);"
          onclick={() => handleClick(section.id)}
        >
          <span class="d-flex align-items-center py-1">
            <section.icon size={20} class="flex-shrink-0" />
          </span>
          <span class={activeSection === section.id ? 'text-body' : 'text-body-secondary'}>{section.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Activity section -->
  <div class="d-flex flex-column gap-2">
    <p class="text-uppercase fs-8 fw-normal text-body mb-0" style="letter-spacing: 0.24px;">
      {t("common.activity", { fallback: "Activity" })}
    </p>
    <div class="d-flex flex-column">
      {#if createdDate}
        <span class="text-body-secondary small">
          {t("objects.sidebar.created", { fallback: "Creation date" })}: {createdDate}
        </span>
      {/if}
      {#if updatedDate}
        <span class="text-body-secondary small">
          {t("objects.sidebar.updated", { fallback: "Last update" })}: {updatedDate}
        </span>
      {/if}
      {#if !createdDate && !updatedDate}
        <span class="text-body-secondary small">
          {t("common.no-recent-activity", { fallback: "No recent activity" })}
        </span>
      {/if}
    </div>
  </div>
</div>
