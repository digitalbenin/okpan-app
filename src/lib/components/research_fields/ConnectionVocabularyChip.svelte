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
    borderStartClass = "border-light",
  } = $props();
</script>

<button
  type="button"
  class="card h-100 w-100 border-0 border-start border-3 {borderStartClass} p-2 text-start rounded-4"
  style="cursor: pointer; background: white;"
  onclick={() => onOpen(vocabulary?.id)}
>
  <div class="d-flex align-items-center justify-content-between w-100">
    <div class="d-flex align-items-center gap-2 min-w-0">
      <div class="bg-light rounded-5 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 41px; height: 41px;">
        {#if vocabulary?.mainAsset}
          <BaseImage
            asset={vocabulary.mainAsset}
            preferredFormat="sm"
            alt={vocabulary.option?.content || imageAltFallback}
            class="rounded-5 w-100 h-100"
            objectFit="cover"
            compact={true}
          />
        {:else}
          <i class="bi bi-image text-muted" style="font-size: 1.25rem;"></i>
        {/if}
      </div>
      <p class="mb-0 text-truncate fw-semibold" style="font-size: 14px;" title={vocabulary?.option?.content}>
        {vocabulary?.option?.content || untitledLabel}
      </p>
    </div>

    <div class="flex-shrink-0" role="presentation" onclick={(event) => event.stopPropagation()}>
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