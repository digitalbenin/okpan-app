<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { goto } from "$app/navigation";
  import { back } from "$lib/utils/navigation.js";

  const { institution } = $props();
  const { t } = getTranslationStore();

  const handleEdit = () => {
    goto(
      `/projects/${institution.project_id}/institutions/${institution.id}/edit`,
    );
  };
</script>

<div class="container-fluid pb-4" style="overflow: visible;">
  <div class="row mb-2">
    <div class="col-12">
      <div
        class="d-flex align-items-start gap-3 mt-3"
        style="overflow: visible;"
      >
        <div>
          <button
            class="btn btn-lg btn-light rounded-circle aspect-ratio-1x1"
            aria-label="back"
            onclick={back}><i class="bi bi-arrow-left"></i></button
          >
        </div>
        <h1>
          {institution.name.content}
          <span class="badgeWrapper fs-6">
            <BaseBadgeStatus status={institution.status} />
          </span>
        </h1>
        <div class="ms-auto">
          <BaseButton
            class="btn btn-outline-secondary btn border-0"
            onClick={handleEdit}
            text={t("common.edit-institution", {
              fallback: "Edit",
            })}
            icon="pencil"
          ></BaseButton>
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    {#if institution.description}
      <div class="col-4">
        <div class="fw-bold text-muted text-uppercase fs-7">
          {t("common.description", { fallback: "Description" })}
        </div>
        <div>
          {institution.description.content}
        </div>
      </div>
    {/if}
    {#if institution.country}
      <div class="col">
        <div class="fw-bold text-muted text-uppercase fs-7">
          {t("common.country", { fallback: "Country" })}
        </div>
        <div>
          {institution.country.content}
        </div>
      </div>
    {/if}
    {#if institution.location}
      <div class="col">
        <div class="fw-bold text-muted text-uppercase fs-7">
          {t("common.location", { fallback: "Location" })}
        </div>
        <div>
          {institution.location.content}
        </div>
      </div>
    {/if}
    {#if institution.links}
      <div class="col">
        <div class="fw-bold text-muted text-uppercase fs-7">
          {t("common.links", { fallback: "Links" })}
        </div>
        <div>
          {#each institution.links as link (link.url)}
            <div class="mb-1">
              <a href={link.url} target="_blank">{link.label}</a>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .badgeWrapper {
    font-family: var(--bs-body-font-family) !important;
    vertical-align: text-top;
  }
</style>
