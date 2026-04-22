<script>
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";

  let {
    vocabulary,
    onOpen = () => {},
    onDuplicate = () => {},
    onDelete = () => {},
    untitledLabel = "Untitled",
    duplicateLabel = "Duplicate",
    deleteLabel = "Delete",
    imageAltFallback = "Connection image",
  } = $props();
</script>

<button
  type="button"
  class="card h-100 shadow-sm w-100 border-0 p-0 text-start"
  style="cursor: pointer; background: white;"
  onclick={() => onOpen(vocabulary?.id)}
>
  <div class="card-body d-flex align-items-center justify-content-between gap-3 w-100 p-3">
    <div class="bg-light rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 48px; height: 48px; flex-shrink: 0;">
      {#if vocabulary?.mainAsset}
        <BaseImage
          asset={vocabulary.mainAsset}
          preferredFormat="sm"
          alt={vocabulary.option?.content || imageAltFallback}
          class="rounded-circle w-100 h-100"
          objectFit="cover"
          compact={true}
        />
      {:else}
        <i class="bi bi-image text-muted" style="font-size: 1.5rem;"></i>
      {/if}
    </div>

    <div class="flex-grow-1 min-w-0 overflow-hidden">
      <p class="card-title mb-0 text-truncate" title={vocabulary?.option?.content}>
        {vocabulary?.option?.content || untitledLabel}
      </p>
    </div>

    <div class="flex-shrink-0 ms-auto" role="presentation" onclick={(event) => event.stopPropagation()}>
      <BaseDropdownMenu
        align="end"
        side="bottom"
        sideOffset={4}
        alignOffset={0}
        contentProps={{ style: "right: 0; left: auto;" }}
        triggerClass="btn btn-link text-muted p-0"
      >
        {#snippet trigger()}
          <i class="bi bi-three-dots-vertical"></i>
        {/snippet}
        {#snippet children({ close })}
          <button
            class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2"
            onclick={() => {
              onDuplicate(vocabulary);
              close();
            }}
          >
            <i class="bi bi-files"></i>
            {duplicateLabel}
          </button>
          <button
            class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2 text-danger"
            onclick={() => {
              onDelete(vocabulary);
              close();
            }}
          >
            <i class="bi bi-trash"></i>
            {deleteLabel}
          </button>
        {/snippet}
      </BaseDropdownMenu>
    </div>
  </div>
</button>