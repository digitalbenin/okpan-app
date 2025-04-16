<script>
  import { getContext } from "svelte";
  import { Tabs } from "melt/builders";
  import InstitutionAssets from "./InstitutionAssets.svelte";

  // Get data from context
  const objects = getContext("objects") || [];
  const assets = getContext("assets") || [];

  // Configure tabs with real counts
  let tabsList = [
    { id: "objects", label: `Objects (${objects.length})` },
    { id: "assets", label: `Assets (${assets.length})` },
    { id: "datasources", label: "Data sources" },
  ];

  const tabs = new Tabs({
    defaultValue: "assets", // Set assets as the default selected tab
  });
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col">
      <ul class="nav nav-underline" {...tabs.triggerList}>
        {#each tabsList as tab}
          <li class="nav-item">
            <div
              class="nav-link"
              class:active={tab.id === tabs.value}
              aria-current="page"
              {...tabs.getTrigger(tab.id)}
            >
              {tab.label}
            </div>
          </li>
        {/each}
      </ul>

      <div {...tabs.getContent("objects")}>
        <div class="py-4">
          <h4>Objects Content</h4>
          <p>This tab will display institution objects.</p>
          {#if objects.length === 0}
            <div class="alert alert-info">
              No objects found for this institution.
            </div>
          {:else}
            <p>Found {objects.length} objects.</p>
          {/if}
        </div>
      </div>

      <div {...tabs.getContent("assets")}>
        <InstitutionAssets />
      </div>

      <div {...tabs.getContent("datasources")}>
        <div class="py-4">
          <h4>Data Sources Content</h4>
          <p>This tab will display institution data sources.</p>
        </div>
      </div>
    </div>
  </div>
</div>
