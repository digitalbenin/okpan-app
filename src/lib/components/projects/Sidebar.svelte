<script>
  import { page } from "$app/state";
  import SidebarMenu from "$lib/components/projects/SidebarMenu.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { onMount } from "svelte";
  const { t } = getTranslationStore();

  let systemInfo = $state({ arch: '', platform: '', isDev: false });

  onMount(async () => {
    systemInfo = await window.api.getSystemInfo();
  });

  const projectLinks = $derived([
    {
      label: t("menu.overview", { fallback: "Overview" }),
      url: `/projects/${page.data.project.id}`,
      icon: "house-door-fill",
      exact: true,
    },
    {
      label: t("common.institutions", { fallback: "Institutions" }),
      url: `/projects/${page.data.project.id}/institutions`,
      icon: "bank2",
      exact: true,
    },
    {
      label: t("common.objects", { fallback: "Objects" }),
      url: `/projects/${page.data.project.id}/objects`,
      icon: "box",
      exact: true,
    },
     {
      label: t("common.connections", { fallback: "Connections" }),
      url: `/projects/${page.data.project.id}/connections`,
      icon: "share-fill",
      exact: true,
    },
  ]);

  const actionsLinks = $derived([
    {
      label: t("menu.add-institution", { fallback: "Add Institution" }),
      url: `/projects/${page.data.project.id}/institutions/add`,
      icon: "plus-lg",
      exact: true,
    },
    {
      label: t("menu.add-object", { fallback: "Add Object" }),
      url: `/projects/${page.data.project.id}/objects/add`,
      icon: "plus-lg",
      exact: true,
    },
    {
      label: t("menu.import-data", { fallback: "Import Data" }),
      url: `/projects/${page.data.project.id}/import-data`,
      icon: "box-arrow-in-right",
    },
    {
      label: t("menu.import-assets", { fallback: "Import Media" }),
      url: `/projects/${page.data.project.id}/import-assets`,
      icon: "box-arrow-in-right",
    },
  ]);

  const websiteLinks = $derived([
    {
      label: t("menu.website-settings", { fallback: "Website Settings" }),
      url: `/projects/${page.data.project.id}/website-settings`,
      icon: "gear",
      exact: true,
    },
    {
      label: t("menu.export-website", { fallback: "Export Website" }),
      url: `/projects/${page.data.project.id}/export-website`,
      icon: "globe",
      exact: true,
    },
    {
      label: t("menu.export-data", { fallback: "Export Data" }),
      url: `/projects/${page.data.project.id}/export`,
      icon: "box-arrow-up-right",
    },
  ]);

  const otherLinks = $derived([
    {
      label: t("menu.data-structure", { fallback: "Data Structure" }),
      icon: "table",
      children: [
        {
          label: t("filters.research-fields", { fallback: "Research Fields" }),
          url: `/projects/${page.data.project.id}/data-structure/research-fields`,
          icon: "",
        },
        {
          label: t("menu.default-fields", { fallback: "Default Fields" }),
          url: `/projects/${page.data.project.id}/data-structure/default-fields`,
          icon: "",
        },
      ],
    },
    {
      label: t("nav.settings", { fallback: "Settings" }),
      icon: "gear-fill",
      children: [
        {
          label: t("menu.general", { fallback: "General" }),
          url: `/projects/${page.data.project.id}/settings/general`,
          icon: "",
        },
        {
          label: t("menu.sharing", { fallback: "Sharing" }),
          url: `/projects/${page.data.project.id}/settings/sharing`,
          icon: "",
        },
        {
          label: t("menu.recovery-snapshots", { fallback: "Recovery Snapshots" }),
          url: `/projects/${page.data.project.id}/settings/recovery-snapshots`,
          icon: "",
        },
      ],
    },
  ]);
</script>

<div class="sidebar h-100 border-end overflow-y-auto p-3">
  <SidebarMenu items={projectLinks} pathname={page.url.pathname} />
  <div class="text-uppercase small fw-semibold text-secondary mt-3 mb-1 px-1">{t("menu.add-content", { fallback: "Add content" })}</div>
  <SidebarMenu items={actionsLinks} pathname={page.url.pathname} />
  <div class="text-uppercase small fw-semibold text-secondary mt-3 mb-1 px-1">{t("menu.publish", { fallback: "Publish" })}</div>
  <SidebarMenu items={websiteLinks} pathname={page.url.pathname} />
  <div class="text-uppercase small fw-semibold text-secondary mt-3 mb-1 px-1">{t("menu.settings-section", { fallback: "Settings" })}</div>
  <SidebarMenu items={otherLinks} pathname={page.url.pathname} />
  {#if systemInfo.isDev}
    <a href="/debug" class="btn btn-link">debug</a>
    <button
      onclick={() => window.api.openPreview(page.data.project.id)}
      class="btn btn-link">{t("menu.preview", { fallback: "Preview" })}</button
    >
    <div class="mt-3 text-muted small">
      <div>{systemInfo.platform} ({systemInfo.arch})</div>
    </div>
  {/if}
</div>

<style>
  .sidebar {
    width: 300px;
  }
</style>
