<script>
import {IconProgress, IconCheck} from "@tabler/icons-svelte";
  const { stats } = $props();
</script>

<div class="bg-white rounded-4 border overflow-hidden">
  <div class="row g-0 align-items-stretch">
    {#each stats as stat, i}
      {@const pct = stat.percentage !== undefined && stat.value > 0
        ? Math.round((stat.percentage / stat.value) * 100)
        : null}
      <div class="col d-flex flex-column pt-3 pb-2 px-3" class:border-start={i > 0}>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="display-5 fw-normal lh-1">{stat.value}</div>
          <div
            class="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0 {stat.iconBgClass}"
            style="width: 4rem; height: 4rem;"
          >
            <stat.icon class={stat.iconColorClass} size={32} />
          </div>
        </div>
        <div class="mb-3">{stat.label}</div>
        {#if pct !== null}
          <div class="mt-auto">
            <div
              class="progress mb-2"
              role="progressbar"
              aria-label={stat.label}
              aria-valuenow={pct}
              aria-valuemin="0"
              aria-valuemax="100"
              style="height: 4px;"
            >
              <div class="progress-bar bg-success" style="width: {pct}%"></div>
            </div>
            <div class="d-flex align-items-center gap-1">
              {#if pct >= 100}
                <IconCheck class="fs-4 text-success" style="width: 1rem; height: 1rem;" />
                <span class="small fw-semibold text-success">
                  {stat.labelComplete ?? `${pct}% ${stat.labelPercentage}`}
                </span>
              {:else}
                <IconProgress class="fs-4 text-secondary" style="width: 1rem; height: 1rem;" />
                <span class="small fw-semibold text-secondary">{pct}% {stat.labelPercentage}</span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
