<script>
  const { stats } = $props();
  $inspect(stats);
</script>

<div class="bg-white rounded border p-3 h-100 d-flex flex-column">
  {#each stats as stat, i}
    {@const percentage = Math.round((stat.percentage * 100) / stat.value) || 0}
    <div
      class="stat py-2 flex-grow-1"
      class:border-bottom={i < stats.length - 1}
    >
      <div>{stat.label}</div>
      <div class="fs-1">{stat.value}</div>
      {#if stat.percentage !== undefined}
        <div
          class="progress"
          role="progressbar"
          aria-label="Basic example"
          aria-valuenow={percentage}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="progress-bar" style="width: {percentage}%"></div>
        </div>
        <div class="text-muted fs-7">
          {percentage}% {stat.labelPercentage}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .stat {
    min-height: fit-content;
  }
</style>
