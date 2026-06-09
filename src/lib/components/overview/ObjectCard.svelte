<script>
  import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";
  import imgLg from "$assets/img_lg.png";

  let { object, displayFields, displayInstitution = false, selected = $bindable([]), listQuery = "" } = $props();

  const { t, translationState } = getTranslationStore();

  const institution = $derived(object.institution?.name.content);
  const title = $derived.by(
    () =>
      (object?.name?.content && String(object.name.content).trim()) ||
      (typeof object?.name === "string" && String(object.name).trim()) ||
      getObjectIdentifier(object)
  );

  const image = $derived(object.objectsAssets[0]?.asset);

  const withQuery = (url) => (listQuery ? `${url}${listQuery}` : url);

  const isSelectable = $derived(displayFields !== undefined);
  let isSelected = $derived(isSelectable && selected.includes(object.id));

  function handleCheckboxChange(event) {
    event.stopPropagation();
    if (isSelected) {
      selected = selected.filter((id) => id !== object.id);
    } else {
      selected = [...selected, object.id];
    }
  }

  const parsedFields = $derived.by(() => {
    const fields = displayFields || [];
    return fields.map((field) => {
      if (field.type === "object_property") {
        return {
          label: t(`common.${field.value}`, { fallback: field.value }),
          value: formatDate(+object[field.value], translationState.currentLocale, true),
        };
      } else if (field.type === "research_field") {
        const research_field = (object.objectsResearchFields || []).find(
          (rf) => rf?.researchField?.id === field.value
        );
        if (!research_field) return { label: field?.name?.content || "", value: null };
        const value = research_field?.vocabulary?.option?.content ?? research_field?.value ?? null;
        return { label: field?.name?.content || "", value };
      }
    });
  });
</script>

<div
  class="card-object position-relative bg-white border rounded-4 overflow-hidden d-flex flex-column pb-2"
  class:border-primary={isSelected}
  class:border-2={isSelected}
>
  <div class="bg-light d-flex align-items-center justify-content-center overflow-hidden" style="aspect-ratio: 1;">
    {#if image}
      <BaseImage
        class="w-100 h-100"
        objectFit="cover"
        asset={image}
        preferredFormat="sm"
        alt={title || ""}
      />
    {:else}
      <img src={imgLg} alt="" class="w-100 h-100" style="object-fit: cover;" />
    {/if}
  </div>

  {#if isSelectable}
    <div class="position-absolute top-0 end-0 m-2" style="z-index: 2">
      <input
        type="checkbox"
        class="form-check-input"
        style="border: 1px solid var(--bs-gray-800);"
        checked={isSelected}
        onchange={handleCheckboxChange}
        onclick={(e) => e.stopPropagation()}
        aria-label={t("objects.select-object", { fallback: "Select object" })}
      />
    </div>
  {/if}

  <div class="px-3 pt-2 pb-2 d-flex flex-column gap-1">
    {#if isSelectable}
      <a
        href={withQuery(`/projects/${object.project_id}/institutions/${object.institution_id}/objects/${object.id}`)}
        class="fw-semibold text-truncate link-dark text-decoration-none"
      >{title}</a>
    {:else}
      <div class="fw-semibold text-truncate">{title}</div>
    {/if}
    {#if institution}
      <div class="text-body-secondary text-truncate">{institution}</div>
    {/if}
    <BaseBadgeStatus status={object.status} />
  </div>

  {#each parsedFields as field}
    <div class="px-3 mb-1">
      <div class="fs-7 text-muted">{field.label}</div>
      <div class:text-black-50={field.value === null} class:fst-italic={field.value === null}>
        {field.value || t("common.no-value", { fallback: "No value" })}
      </div>
    </div>
  {/each}

  {#if !isSelectable}
    <a
      href="/projects/{object.project_id}/institutions/{object.institution_id}/objects/{object.id}"
      class="stretched-link"
      aria-label={title}
    ></a>
  {/if}
</div>

<style>
  .card-object {
    scroll-snap-align: start;
  }
</style>
