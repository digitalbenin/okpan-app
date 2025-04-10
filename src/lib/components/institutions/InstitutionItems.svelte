<script>
  import { getContext } from "svelte";
  import { Tabs } from "melt/builders";
  const objects = getContext("objects");
  const assets = getContext("assets");

  let tabsList = [
    { id: "objects", label: `Objects` },
    { id: "assets", label: `Assets` },
  ];

  const tabs = new Tabs();
</script>

<div class="container-fluid mt-2">
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
      {#each tabsList as tab}
        <div {...tabs.getContent(tab.id)}>content {tab.id}</div>
      {/each}
    </div>
  </div>
</div>
