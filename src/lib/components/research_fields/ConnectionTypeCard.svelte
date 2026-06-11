<script>
  import { goto } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getTemplateById, getTemplateColorClasses } from "$lib/constants/connectionTemplates.js";
  import { IconEye, IconEyeOff } from "@tabler/icons-svelte";

  let { field, projectId } = $props();
  const { t } = getTranslationStore();

  const templateId = $derived(field.fields_config?.templateId || null);
  const template = $derived(getTemplateById(templateId));
  const colorClasses = $derived(getTemplateColorClasses(templateId));

  const templateLabel = $derived(template?.label || "");
  const description = $derived(field.description?.content || "");
  const isPublished = $derived(field.onwebsite === 1);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="bg-white rounded-4 p-3 d-flex flex-column gap-1 border-0 border-start border-3 {colorClasses.border} cursor-pointer"
  onclick={() => goto(`/projects/${projectId}/connections/${field.id}`)}
  onmouseenter={(e) => e.currentTarget.classList.add('shadow')}
  onmouseleave={(e) => e.currentTarget.classList.remove('shadow')}
  role="button"
  tabindex="0"
>
  {#if templateLabel}
    <p class="fs-8 text-uppercase {colorClasses.text} mb-0" style="letter-spacing: 0.02em;">
      {templateLabel}
    </p>
  {/if}

  <p class="fw-semibold fs-5 mb-0">
    {field.name?.content || t("common.untitled", {fallback: "Untitled"})}
  </p>

  {#if description}
    <p class="small mb-0 overflow-hidden" style="height: 90px;">
      {description}
    </p>
  {:else}
    <div style="height: 90px;"></div>
  {/if}

  <div class="d-flex align-items-center gap-2">
    <div class="d-flex align-items-center gap-1">
      {#if isPublished}
        <IconEye size={16} class="text-secondary flex-shrink-0" />
        <span class="small text-secondary text-nowrap">
          {t("connections.visible-on-website", { fallback: "Visible on website" })}
        </span>
      {:else}
        <IconEyeOff size={16} class="text-secondary flex-shrink-0" />
        <span class="small text-secondary text-nowrap">
          {t("connections.not-visible", { fallback: "Not visible" })}
        </span>
      {/if}
    </div>
    <span class="small text-secondary">·</span>
    <span class="small text-secondary text-nowrap">
      {field.vocabularies?.length || 0} {t("common.connections", { fallback: "connections" })}
    </span>
  </div>
</div>
