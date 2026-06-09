<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { goto } from "$app/navigation";
  import { updateInstitutionStatus } from "$lib/api/InstitutionsApi.js";
  import { IconBuildingBank } from "@tabler/icons-svelte";

  const { institution } = $props();
  const { t } = getTranslationStore();

  const countryContent = $derived(institution?.country?.content?.trim() || "");
  const locationContent = $derived(institution?.location?.content?.trim() || "");
  const descriptionContent = $derived(institution?.description?.content?.trim() || "");
  const primaryLink = $derived.by(() => {
    const validLink = (institution?.links || []).find((link) => link?.url?.trim());
    if (!validLink) return null;

    return {
      url: validLink.url.trim(),
      label: validLink.label?.trim() || t("common.website"),
    };
  });

  const breadcrumbItems = $derived([
    { label: t("common.institutions"), href: `/projects/${institution.project_id}/institutions` },
    { label: institution.name.content },
  ]);

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

<div class="container-fluid pt-0 pb-3" style="overflow: visible;">
  <div class="row">
    <div class="col-12">
      <div class="d-flex align-items-center justify-content-between" style="overflow: visible;">
        <BaseBreadcrumb icon={IconBuildingBank} items={breadcrumbItems} />

        <div class="d-flex align-items-center gap-2 flex-shrink-0" style="overflow: visible;">
        
          <BaseButton
            class="btn btn-outline-secondary btn border-0"
            onClick={handleEdit}
            text={t("common.edit-info")}
            icon="pencil"
          ></BaseButton>
        </div>
      </div>

      <div class="mt-2">
        <h1 class="mb-1">{institution.name.content}</h1>

        {#if countryContent || locationContent || primaryLink}
          <div
            class="text-muted"
            style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
          >
            {#if countryContent}
              <span>{countryContent}</span>
            {/if}
            {#if countryContent && locationContent}
              <span class="mx-1">·</span>
            {/if}
            {#if locationContent}
              <span>{locationContent}</span>
            {/if}
            {#if (countryContent || locationContent) && primaryLink}
              <span class="mx-1">·</span>
            {/if}
            {#if primaryLink}
              <a
                class="link-secondary"
                href={primaryLink.url}
                target="_blank"
                rel="noreferrer"
              >
                {primaryLink.label}
              </a>
            {/if}
          </div>
        {/if}

        {#if descriptionContent}
          <div class="mt-2">{descriptionContent}</div>
        {/if}
      </div>
    </div>
  </div>
</div>


