<script>
  const { stats } = $props();
</script>

<div class="bg-white rounded-2 border overflow-hidden">
  <div class="row g-0 align-items-stretch">
    {#each stats as stat, i}
      {@const pct = stat.percentage !== undefined && stat.value > 0
        ? Math.round((stat.percentage / stat.value) * 100)
        : null}
      <div class="col d-flex flex-column pt-3 pb-2 px-3" class:border-start={i > 0}>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="display-5 fw-normal lh-1">{stat.value}</div>
          <div
            class="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
            style="width: 4rem; height: 4rem; background-color: {stat.iconBgColor};"
          >
            <i class="bi bi-{stat.icon} fs-2" style="color: {stat.iconColor};"></i>
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
                <i class="bi bi-check text-success"></i>
                <span class="small fw-semibold text-success">
                  {stat.labelComplete ?? `${pct}% ${stat.labelPercentage}`}
                </span>
              {:else}
                <i class="bi bi-circle-half text-secondary"></i>
                <span class="small fw-semibold text-secondary">{pct}% {stat.labelPercentage}</span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
