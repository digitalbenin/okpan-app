<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconBuildingBank } from "@tabler/icons-svelte";

  let {
    projectId = "",
    institutionId = "",
    institutionName = "",
    title = "",
    status = "",
    statusDisabled = false,
    showStatus = true,
    onStatusChange = undefined,
    languages = [],
    activeLanguage = null,
    onLanguageChange = undefined,
  } = $props();

  const { t } = getTranslationStore();

  const breadcrumbItems = $derived([
    { label: t("common.institutions"), href: `/projects/${projectId}/institutions` },
    { label: institutionName, href: `/projects/${projectId}/institutions/${institutionId}` },
    { label: title },
  ]);

  const showLanguageSelector = $derived(languages?.length > 1);

  function handleStatusClick() {
    if (statusDisabled) return;
    const next = status === "completed" ? "in progress" : "completed";
    onStatusChange?.(next);
  }
</script>

<div class="border-bottom  py-3 w-100">
  <div class="d-flex justify-content-between align-items-start gap-2">
    <div class="flex-grow-1" style="min-width: 0;">
      <BaseBreadcrumb icon={IconBuildingBank} items={breadcrumbItems} />
    </div>

    {#if showLanguageSelector}
      <div class="flex-shrink-0">
        <select
          class="form-select form-select-sm"
          style="background-color: #7A7A76; color: #fff; border-color: #7A7A76; --bs-form-select-bg-img: url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3e%3cpath fill=%27none%27 stroke=%27%23fff%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27m2 5 6 6 6-6%27/%3e%3c/svg%3e');"
          value={activeLanguage || languages[0]?.id || ''}
          onchange={(e) => onLanguageChange?.(e.target.value)}
        >
          {#each languages as lang}
            <option value={lang.id}>{lang.name?.content || lang.code}</option>
          {/each}
        </select>
      </div>
    {/if}
  </div>

  <div class="d-flex align-items-center gap-2 mt-1">
    <h2 class="mb-0" style="font-family: var(--bs-heading-font-family, 'Crimson Pro', serif); font-size: 32px; letter-spacing: -0.64px; color: var(--bs-body-color);">{title}</h2>
    {#if showStatus}
      <div class="flex-shrink-0">
        {#if onStatusChange}
          <button
            type="button"
            class="btn btn-link p-0 border-0 text-decoration-none"
            disabled={statusDisabled}
            onclick={handleStatusClick}
          >
            <BaseBadgeStatus status={status} showChevron={true} className="px-2 py-1 rounded-3" />
          </button>
        {:else}
          <BaseBadgeStatus status={status} showChevron={false} className="px-2 py-1 rounded-3" />
        {/if}
      </div>
    {/if}
  </div>
</div>

