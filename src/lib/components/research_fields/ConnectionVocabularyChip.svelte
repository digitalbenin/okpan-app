<script>
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import { IconDotsVertical } from "@tabler/icons-svelte";

  let {
    vocabulary,
    objectsCount = 0,
    onOpen = () => {},
    onDuplicate = () => {},
    onDelete = () => {},
    untitledLabel = "Untitled",
    duplicateLabel = "Duplicate",
    deleteLabel = "Delete",
    objectsCountLabel = "objects",
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
      <div class="rounded-5 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 41px; height: 41px; background-color: #e9eef1;">
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
          <BaseImage
            alt={imageAltFallback}
            class="rounded-5 w-100 h-100"
            objectFit="cover"
            compact={true}
          />
        {/if}
      </div>
      <div class="d-flex flex-column min-w-0 overflow-hidden" style="max-width: 200px;">
        <p class="mb-0 text-truncate fw-semibold" style="font-size: 14px;" title={vocabulary?.option?.content}>
          {vocabulary?.option?.content || untitledLabel}
        </p>
        <p class="mb-0 text-muted small">
          {objectsCount} {objectsCountLabel}
        </p>
      </div>
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
          <IconDotsVertical size={16} />
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