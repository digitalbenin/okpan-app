<script>
  import { IconInfoCircle, IconBulb } from "@tabler/icons-svelte";

  let {
    title,
    description,
    icon: IconComponent = IconInfoCircle,
    closeable = false,
    onClose = undefined,
    example = "",
    tip = "",
    headerClass = "",
    paddingClass = "p-3",
    border = true,
  } = $props();

  // Use expanded layout when there's any extra content (closeable, example, or tip)
  const isExpanded = $derived(closeable || example || tip);
</script>

<div class="bg-white {border ? 'border' : ''} rounded-4 {paddingClass}">
  {#if isExpanded}
    <!-- Expanded layout: header bar + description + example + tip -->
    <div class="d-flex justify-content-between align-items-start pb-2 border-bottom mb-3">
      <div class="d-flex gap-1 align-items-center">
        <span class="d-flex align-items-center">
          <IconComponent size={16} stroke={2} />
        </span>
        <p class="fw-semibold mb-0 text-body {headerClass}">{title}</p>
      </div>
      {#if closeable}
        <button type="button" class="btn-close opacity-50 p-1" aria-label="Close" onclick={() => onClose?.()}></button>
      {/if}
    </div>
    {#if description}
      <p class="mb-0 text-body-secondary">{description}</p>
    {/if}
    {#if example}
      <div class="mt-3">
        <p class="text-uppercase fs-8 fw-normal text-body-secondary mb-2" style="letter-spacing: 0.24px;">
          Example
        </p>
        <div class="bg-body-secondary rounded-3 p-3">
          <p class="mb-0 text-body-secondary small">{example}</p>
        </div>
      </div>
    {/if}
    {#if tip}
      <div class="mt-3 border rounded-3 p-3 d-flex gap-2 align-items-start" style="border-color: #99ccbf !important; background: linear-gradient(90deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) 100%), linear-gradient(90deg, #008060 0%, #008060 100%);">
        <span class="d-flex align-items-center mt-0 flex-shrink-0" style="padding-top: 4px;">
          <IconBulb size={16} stroke={2} />
        </span>
        <p class="mb-0 text-body small">{tip}</p>
      </div>
    {/if}
  {:else}
    <!-- Compact layout: original icon + title + description row (backward-compatible) -->
    <div class="d-flex gap-3 align-items-start">
      <div class="d-flex align-items-center mt-1">
        <IconComponent size={16} stroke={2} />
      </div>
      <div>
        <p class="fw-semibold mb-1 text-body">{title}</p>
        <p class="mb-0 text-secondary fs-7">{description}</p>
      </div>
    </div>
  {/if}
</div>
