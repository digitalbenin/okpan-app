<script>
  import { Tabs } from "melt/builders";

  let { tabsList } = $props();
  //   let tabsList = [
  //     { id: "objects", label: `Objects` },
  //     { id: "assets", label: `Assets` },
  //   ];

  const tabs = new Tabs({ value: tabsList[0].id });
</script>

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
