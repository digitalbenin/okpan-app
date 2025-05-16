<script>
  import { page } from "$app/state";
  import { Tabs } from "melt/builders";
  import InstitutionAssets from "./InstitutionAssets.svelte";
  import InstitutionObjects from "./InstitutionObjects.svelte";
  import InstitutionDatasources from "./InstitutionDatasources.svelte";

  // Get data from context
  let objects = $derived(page.data.objects);
  let assets = $derived(page.data.assets);
  let datasources = $derived(page.data.datasources);

  // Configure tabs with real counts
  let tabsList = [
    { id: "objects", label: `Objects (${objects.institutionTotal})` },
    { id: "assets", label: `Assets (${assets.institutionTotal})` },
    { id: "datasources", label: `Data sources (${datasources.length})` },
  ];

  const tabs = new Tabs({
    value: "objects",
  });
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col">
      <ul class="nav nav-underline border-bottom" {...tabs.triggerList}>
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

      <div {...tabs.getContent("objects")} class="py-3">
        <InstitutionObjects />
      </div>

      <div {...tabs.getContent("assets")}>
        <InstitutionAssets />
      </div>

      <div {...tabs.getContent("datasources")}>
        <InstitutionDatasources />
      </div>
    </div>
  </div>
</div>
