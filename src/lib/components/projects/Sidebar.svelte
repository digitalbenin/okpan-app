<script>
  import { page } from "$app/state";
  import SidebarMenu from "$lib/components/projects/SidebarMenu.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();

  const projectLinks = $derived([
    {
      label: t("menu.overview", { fallback: "Overview" }),
      url: `/projects/${page.data.project.id}`,
      icon: "house-door-fill",
      exact: true,
    },
    {
      label: t("menu.institutions", { fallback: "Institutions" }),
      url: `/projects/${page.data.project.id}/institutions`,
      icon: "bank2",
    },
    {
      label: t("menu.objects", { fallback: "Objects" }),
      url: `/projects/${page.data.project.id}/objects`,
      icon: "box",
      exact: true,
    },
     {
      label: t("menu.connections", { fallback: "Connections" }),
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
    {
      label: t("menu.export-data", { fallback: "Export Data" }),
      url: `/projects/${page.data.project.id}/export`,
      icon: "box-arrow-up-right",
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
  ]);

  const otherLinks = $derived([
    {
      label: t("menu.data-structure", { fallback: "Data Structure" }),
      icon: "table",
      children: [
        {
          label: t("menu.research-fields", { fallback: "Research Fields" }),
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
      label: t("menu.settings", { fallback: "Project Settings" }),
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
      ],
    },
  ]);
</script>

<div class="sidebar h-100 border-end overflow-y-auto p-3">
  <h5>{page.data.project.title.content}</h5>
  <SidebarMenu items={projectLinks} pathname={page.url.pathname} />
  <h5>Actions</h5>
  <SidebarMenu items={actionsLinks} pathname={page.url.pathname} />
  <h5>Website</h5>
  <SidebarMenu items={websiteLinks} pathname={page.url.pathname} />
  <h5>Other</h5>
  <SidebarMenu items={otherLinks} pathname={page.url.pathname} />
  <a href="/debug" class="btn btn-link">debug</a>
  <button
    onclick={() => window.api.openPreview(page.data.project.id)}
    class="btn btn-link">Preview</button
  >
</div>

<style>
  .sidebar {
    width: 300px;
  }
</style>
