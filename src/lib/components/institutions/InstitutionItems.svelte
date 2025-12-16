<script>
  import { Tabs } from "bits-ui";
  import InstitutionAssets from "./InstitutionAssets.svelte";
  import InstitutionObjects from "./InstitutionObjects.svelte";
  import InstitutionDatasources from "./InstitutionDatasources.svelte";
  import InstitutionMappings from "./InstitutionMappings.svelte";

  let { view = $bindable(), params = $bindable(), ...restProps } = $props();

  const tabsList = $derived([
    {
      value: "objects",
      label: "Objects",
      icon: "bi-box",
      count: restProps.institution?.objectsCount ?? restProps.objects?.totalCount ?? 0,
    },
    {
      value: "assets",
      label: "Media",
      icon: "bi-image",
      count: restProps.institution?.assetsCount ?? restProps.assets?.totalCount ?? 0,
    },
    {
      value: "mappings",
      label: "Data mapping",
      icon: "bi-arrow-left-right",
      count: restProps.mappingTemplates?.length ?? 0,
    },
    {
      value: "datasources",
      label: "Data sources",
      icon: "bi-table",
      count:
        restProps.institution?.datasourcesCount ??
        restProps.datasources?.totalCount ??
        0,
    },
  ]);
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col">
      <Tabs.Root bind:value={view}>
        <Tabs.List>
          <div class="institution-tabs bg-light rounded-3">
            <ul class="nav nav-underline mb-0">
              {#each tabsList as tab}
                <Tabs.Trigger forceMount value={tab.value}>
                  {#snippet child({ props })}
                    <li {...props} class="nav-item me-1">
                      <div
                        class="nav-link d-flex align-items-center gap-1 rounded-2 fs-6"
                        class:active={view === tab.value}
                      >
                        {#if tab.icon}
                          <i class={"bi " + tab.icon}></i>
                        {/if}
                        <span>{tab.label}</span>
                        <span class="text-secondary opacity-50 ms-1">{tab.count}</span>
                      </div>
                    </li>
                  {/snippet}
                </Tabs.Trigger>
              {/each}
            </ul>
          </div>
        </Tabs.List>

        <!-- Tab Content -->
        <div class="bg-white">
          <div class="tab-content p-3">
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
              {:else if view === "mappings"}
                <InstitutionMappings
                  institution={restProps.institution}
                  mappingTemplates={restProps.mappingTemplates}
                  ontologyFields={restProps.ontologyFields}
                />
              {/if}
            </Tabs.Content>
          {/each}
          </div>
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
<style>
  .institution-tabs .nav-link {
    border-bottom: 0;
    color: var(--bs-body-color);
    padding: 0.5rem 0.75rem;
  }

  .institution-tabs .nav-link:hover {
    border-bottom: 0;
  }

  .institution-tabs .nav-link.active {
    border-bottom: 0;
    background: var(--bs-white);
    font-weight: 400;
  }
</style>
