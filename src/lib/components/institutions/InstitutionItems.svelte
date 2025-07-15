<script>
  import { Tabs } from "bits-ui";
  import InstitutionAssets from "./InstitutionAssets.svelte";
  import InstitutionObjects from "./InstitutionObjects.svelte";
  import InstitutionDatasources from "./InstitutionDatasources.svelte";

  let { view = $bindable(), ...restProps } = $props();
  // // Get data from context
  // let objects = $derived(page.data.objects);
  // let assets = $derived(page.data.assets);
  // let datasources = $derived(page.data.datasources);

  // // Configure tabs with real counts
  // let tabsList = [
  //   { id: "objects", label: `Objects (${objects.institutionTotal})` },
  //   { id: "assets", label: `Assets (${assets.institutionTotal})` },
  //   { id: "datasources", label: `Data sources (${datasources.length})` },
  // ];

  let tabIds = ["objects", "assets", "datasources"];
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col">
      <Tabs.Root bind:value={view}>
        <Tabs.List>
          <ul class="nav nav-underline border-bottom mb-3">
            {#each tabIds as id}
              <Tabs.Trigger forceMount value={id}>
                {#snippet child({ props })}
                  <li {...props} class="nav-item">
                    <div class="nav-link" class:active={view === id}>
                      {id}
                    </div>
                  </li>
                {/snippet}
              </Tabs.Trigger>
            {/each}
          </ul>
        </Tabs.List>

        <!-- Tab Content -->
        <div class="tab-content">
          {#each tabIds as id}
            <Tabs.Content value={id}>
              {#if view === "objects"}
                <InstitutionObjects />
              {:else if view === "assets"}
                <InstitutionAssets />
              {:else if view === "datasources"}
                <InstitutionDatasources />
              {/if}
            </Tabs.Content>
          {/each}
        </div>
      </Tabs.Root>
    </div>
  </div>
</div>
<!-- 
<div class="container-fluid">
  <div class="row">
    <div class="col">
      <ul class="nav nav-underline border-bottom" {...tabs.triggerList}>
        {#each tabsList as tab}
          <li class="nav-item cursor-pointer">
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
</div> -->
