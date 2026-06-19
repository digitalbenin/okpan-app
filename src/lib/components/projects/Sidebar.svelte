<script>
  import { page } from "$app/state";
  import SidebarMenu from "$lib/components/projects/SidebarMenu.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { onMount } from "svelte";
  import { IconHelp } from "@tabler/icons-svelte";

  const { t } = getTranslationStore();

  let systemInfo = $state({ arch: '', platform: '', isDev: false });

  onMount(async () => {
    systemInfo = await window.api.getSystemInfo();
  });

  const projectLinks = $derived([
    {
      label: t("menu.overview", { fallback: "Overview" }),
      url: `/projects/${page.data.project.id}`,
      icon: "layout-dashboard",
      exact: true,
    },
    {
      label: t("common.institutions", { fallback: "Institutions" }),
      url: `/projects/${page.data.project.id}/institutions`,
      icon: "building-bank",
      excludePaths: ['/add'],
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
      icon: "chart-circles",
      exact: true,
    },
  ]);

  const actionsLinks = $derived([
    {
      label: t("menu.add-institution", { fallback: "Add institution" }),
      url: `/projects/${page.data.project.id}/institutions/add`,
      icon: "circle-plus",
      exact: true,
    },
    {
      label: t("menu.add-object", { fallback: "Add object" }),
      url: `/projects/${page.data.project.id}/objects/add`,
      icon: "circle-plus",
      exact: true,
    },
    {
      label: t("menu.import-data", { fallback: "Import data" }),
      url: `/projects/${page.data.project.id}/import-data`,
      icon: "table-import",
    },
    {
      label: t("menu.import-assets", { fallback: "Import media" }),
      url: `/projects/${page.data.project.id}/import-assets`,
      icon: "photo-up",
    },
  ]);

  const websiteLinks = $derived([
    {
      label: t("menu.website-settings", { fallback: "Website settings" }),
      url: `/projects/${page.data.project.id}/website-settings`,
      icon: "world-cog",
      exact: true,
    },
    {
      label: t("menu.export-website", { fallback: "Export website" }),
      url: `/projects/${page.data.project.id}/export-website`,
      icon: "world-up",
      exact: true,
    },
    {
      label: t("menu.export-data", { fallback: "Export data" }),
      url: `/projects/${page.data.project.id}/export`,
      icon: "table-export",
    },
  ]);

  const otherLinks = $derived([
    {
      label: t("menu.object-fields", { fallback: "Object fields" }),
      icon: "table-options",
      children: [
        {
          label: t("menu.mapping-fields", { fallback: "Mapping fields" }),
          url: `/projects/${page.data.project.id}/data-structure/research-fields`,
          icon: "",
        },
        {
          label: t("menu.custom-fields", { fallback: "Custom fields" }),
          url: `/projects/${page.data.project.id}/data-structure/default-fields`,
          icon: "",
        },
      ],
    },
    {
      label: t("menu.project-settings", { fallback: "Project settings" }),
      icon: "settings",
      children: [
        {
          label: t("menu.general-settings", { fallback: "General settings" }),
          url: `/projects/${page.data.project.id}/settings/general`,
          icon: "",
        },
        {
          label: t("menu.share-project", { fallback: "Share project" }),
          url: `/projects/${page.data.project.id}/settings/sharing`,
          icon: "",
        },
        {
          label: t("menu.export-project", { fallback: "Export project" }),
          url: `/projects/${page.data.project.id}/export`,
          icon: "",
        },
        {
          label: t("menu.recovery-snapshots", { fallback: "Back-ups" }),
          url: `/projects/${page.data.project.id}/settings/recovery-snapshots`,
          icon: "",
        },
      ],
    },
  ]);
</script>

<div class="sidebar bg-white h-100 border-end border-gray-400 overflow-y-auto px-3 py-3 d-flex flex-column justify-content-between">
  <div class="d-flex flex-column gap-4">
    <div class="d-flex flex-column">
      <SidebarMenu items={projectLinks} pathname={page.url.pathname} />
    </div>

    <div class="d-flex flex-column gap-1">
      <p class="fs-8 text-uppercase text-body m-0" style="letter-spacing: 0.24px;">
        {t("menu.add-content", { fallback: "Add content" })}
      </p>
      <SidebarMenu items={actionsLinks} pathname={page.url.pathname} />
    </div>

    <div class="d-flex flex-column gap-1">
      <p class="fs-8 text-uppercase text-body m-0" style="letter-spacing: 0.24px;">
        {t("menu.publish", { fallback: "Publish" })}
      </p>
      <SidebarMenu items={websiteLinks} pathname={page.url.pathname} />
    </div>

    <div class="d-flex flex-column gap-1">
      <p class="fs-8 text-uppercase text-body m-0" style="letter-spacing: 0.24px;">
        {t("menu.settings-section", { fallback: "Settings" })}
      </p>
      <SidebarMenu items={otherLinks} pathname={page.url.pathname} />
    </div>
  </div>

  {#if systemInfo.isDev}
    <div class="d-flex flex-column gap-1 mt-3">
      <a href="/debug" class="btn btn-link text-start">debug</a>
      <button
        onclick={() => window.api.openPreview(page.data.project.id)}
        class="btn btn-link text-start">{t("menu.preview", { fallback: "Preview" })}</button
      >
      <div class="text-muted small">
        <div>{systemInfo.platform} ({systemInfo.arch})</div>
      </div>
    </div>
  {/if}

  <button class="btn btn-outline-secondary d-flex align-items-center justify-content-center gap-2">
    <IconHelp size={14} stroke={2} />
    {t("common.help", { fallback: "Help" })}
  </button>
</div>

<style>
  .sidebar {
    width: 236px;
  }
</style>
