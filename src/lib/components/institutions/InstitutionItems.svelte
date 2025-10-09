<script>
  import { Tabs } from "bits-ui";
  import InstitutionAssets from "./InstitutionAssets.svelte";
  import InstitutionObjects from "./InstitutionObjects.svelte";
  import InstitutionDatasources from "./InstitutionDatasources.svelte";

  let { view = $bindable(), params = $bindable(), ...restProps } = $props();

  const tabsList = $derived([
    {
      value: "objects",
      label: `Objects [${restProps.objects.totalCount}/${restProps.institution.objectsCount}]`,
    },
    {
      value: "assets",
      label: `Media [${restProps.assets.totalCount}/${restProps.institution.assetsCount}]`,
    },
    {
      value: "datasources",
      label: `Data sources [${restProps.datasources.totalCount}/${restProps.institution.datasourcesCount}]`,
    },
  ]);
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col">
      <Tabs.Root bind:value={view}>
        <Tabs.List>
          <ul class="nav nav-underline border-bottom border-top mb-3">
            {#each tabsList as tab}
              <Tabs.Trigger forceMount value={tab.value}>
                {#snippet child({ props })}
                  <li {...props} class="nav-item">
                    <div class="nav-link" class:active={view === tab.value}>
                      {tab.label}
                    </div>
                  </li>
                {/snippet}
              </Tabs.Trigger>
            {/each}
          </ul>
        </Tabs.List>

        <!-- Tab Content -->
        <div class="tab-content">
          {#each tabsList as tab}
            <Tabs.Content value={tab.value}>
              {#if view === "objects"}
                <InstitutionObjects
                  institution={restProps.institution}
                  objects={restProps.objects}
                  ontologyFields={restProps.ontologyFields}
                  displayFields={restProps.displayFields}
                  researchFields={restProps.researchFields}
                  bind:params
                />
              {:else if view === "assets"}
                <InstitutionAssets
                  institution={restProps.institution}
                  assets={restProps.assets}
                  bind:params
                />
              {:else if view === "datasources"}
                <InstitutionDatasources
                  institution={restProps.institution}
                  datasources={restProps.datasources}
                  bind:params
                />
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
