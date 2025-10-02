<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';
    let { project, settings } = $props();
    let expanded = $state(false);

    const titleText = $derived.by(() => settings?.title || project?.name || 'Untitled Project');
    const logoUrl = $derived.by(() => (settings?.logo_asset_path ? getAssetUrl({ asset_path: settings.logo_asset_path }) : ''));

    function toggle() {
        expanded = !expanded;
    }
</script>

{#if !expanded}
	<!-- Collapsed header only: image left, title center ellipsed, toggle right -->
	<div
		class="d-flex align-items-center py-2 px-2 border-bottom bg-white"
		aria-expanded={expanded}
		role="banner"
	>
		<!-- Left: image/icon -->
        <div
            class="d-flex align-items-center justify-content-center bg-light rounded flex-shrink-0"
            style="width: 48px; height: 48px;"
        >
            {#if logoUrl}
                <img src={logoUrl} alt={titleText} style="max-width: 100%; max-height: 100%; object-fit: contain;" />
            {:else}
                <i class="bi bi-image text-secondary opacity-50 fs-3"></i>
            {/if}
        </div>

		<!-- Center: title (ellipsed) -->
		<div class="flex-grow-1 text-center px-2" style="overflow: hidden;">
            <div
                class="h5 mb-0 text-truncate"
                style="white-space: nowrap;"
                title={titleText}
            >
                {titleText}
            </div>
		</div>

		<!-- Right: expand button -->
		<div class="flex-shrink-0">
			<button class="btn btn-light" aria-label="Expand" onclick={toggle}>
				<i class="bi bi-chevron-down"></i>
			</button>
		</div>
	</div>
{:else}
	<!-- Expanded content only -->
	<div class="border-bottom bg-white px-3 pb-3 pt-2">
		<div class="d-flex justify-content-end"></div>
		<div class="d-flex align-items-start justify-content-between gap-3">
            <div
                class="d-flex align-items-center justify-content-center bg-light rounded p-4"
                style="width: 96px; height: 96px;"
            >
                {#if logoUrl}
                    <img src={logoUrl} alt={titleText} style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                {:else}
                    <i class="bi bi-image text-secondary opacity-50 display-4"></i>
                {/if}
            </div>
			<button class="btn btn-light" aria-label="Collapse" onclick={toggle}>
				<i class="bi bi-chevron-up"></i>
			</button>
		</div>
		<div class="mt-3">
            <h1 class="mb-3">{titleText}</h1>
			<p>{project?.description || ''}</p>
		</div>
	</div>
{/if}

<!-- (Removed duplicate expanded panel to avoid double rendering) -->
