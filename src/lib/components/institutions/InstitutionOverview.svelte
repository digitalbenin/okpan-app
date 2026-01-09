<script>
  import StatusBadgeDropdown from "$lib/components/common/StatusBadgeDropdown.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { goto } from "$app/navigation";
  import { updateInstitutionStatus } from "$lib/stores/InstitutionsUtils.js";

  const { institution } = $props();
  const { t } = getTranslationStore();

  const handleBack = () => {
    goto(`/projects/${institution.project_id}/institutions`);
  };

  const handleEdit = () => {
    goto(
      `/projects/${institution.project_id}/institutions/${institution.id}/edit`,
    );
  };

  let statusUpdating = $state(false);

  async function setStatus(nextStatus) {
    if (!institution?.id || statusUpdating) return;
    statusUpdating = true;
    try {
      const res = await updateInstitutionStatus(institution.id, nextStatus);
      if (res?.error) {
        console.error("Failed to update institution status:", res.error);
      } else {
        institution.status = nextStatus;
      }
    } catch (err) {
      console.error("Error updating institution status:", err);
    } finally {
      statusUpdating = false;
    }
  }
</script>

<div class="container-fluid py-3" style="overflow: visible;">
  <div class="row">
    <div class="col-12">
      <div class="d-flex align-items-center justify-content-between" style="overflow: visible;">
        <button
          class="btn btn-link text-decoration-none px-0"
          aria-label={t("common.institutions", { fallback: "Institutions" })}
          onclick={handleBack}
        >
          <i class="bi bi-arrow-left"></i>
          {t("common.institutions", { fallback: "Institutions" })}
        </button>

        <div class="d-flex align-items-center gap-2" style="overflow: visible;">
          <StatusBadgeDropdown
            status={institution.status}
            disabled={statusUpdating}
            on:change={(e) => setStatus(e.detail)}
          />
          <BaseButton
            class="btn btn-outline-secondary btn border-0"
            onClick={handleEdit}
            text={t("common.edit-info", {
              fallback: "Edit info",
            })}
            icon="pencil"
          ></BaseButton>
        </div>
      </div>

      <div class="mt-2">
        <h1 class="mb-1">{institution.name.content}</h1>

        {#if institution.country || institution.location || (institution.links && institution.links.length)}
          <div
            class="text-muted"
            style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
          >
            {#if institution.country}
              <span>{institution.country.content}</span>
            {/if}
            {#if institution.country && institution.location}
              <span class="mx-1">·</span>
            {/if}
            {#if institution.location}
              <span>{institution.location.content}</span>
            {/if}
            {#if (institution.country || institution.location) && institution.links && institution.links.length}
              <span class="mx-1">·</span>
            {/if}
            {#if institution.links && institution.links.length}
              <a
                class="link-secondary"
                href={institution.links[0].url}
                target="_blank"
                rel="noreferrer"
              >
                {institution.links[0].label || t("common.website", { fallback: "Website" })}
              </a>
            {/if}
          </div>
        {/if}

        {#if institution.description}
          <div class="mt-2">{institution.description.content}</div>
        {/if}
      </div>
    </div>
  </div>
</div>


