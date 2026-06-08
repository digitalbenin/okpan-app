<script>
  /**
   * Shared page-level header used by all main section pages (Institutions, Connections, etc.).
   * Renders the white top band with icon, title and optional description.
   *
   * @prop {import('svelte').Component} icon - A Tabler or Bootstrap icon component.
   * @prop {string} iconBgClass - Bootstrap background utility for the icon wrapper (e.g. "bg-blue-100").
   * @prop {string} iconColorClass - Text colour utility for the icon (e.g. "text-blue-400").
   * @prop {string} title - The page title.
   * @prop {string} [description] - Optional subtitle shown below the title row.
   */
  const { icon: Icon, iconBgClass, iconColorClass, title, description } = $props();
</script>

<div class="bg-white border-bottom mx-n4 mt-n4 px-4 py-3">
  <div class="d-flex flex-column gap-3">
    <div class="d-flex align-items-center gap-3">
      <div class="{iconBgClass} rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
        <Icon size={32} class={iconColorClass} />
      </div>
      <h1 class="mb-0 flex-grow-1">{title}</h1>
    </div>
    {#if description}
      <p class="fs-7 text-body-secondary mb-0">{description}</p>
    {/if}
  </div>
</div>
