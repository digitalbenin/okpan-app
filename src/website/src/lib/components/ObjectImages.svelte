<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	const { assets = [] } = $props();
	const { t } = getWebsiteTranslationStore();

	// Normalize and keep only items that have a file path
	const items = $derived.by(() => (assets || []).filter((a) => a && a.asset_path));

	let selectedIndex = $state(0);
	const selected = $derived.by(() => items[selectedIndex] ?? null);

	// Zoom step reused for toolbar buttons (OSD handles wheel/pinch)
	const zoomStep = 0.25; // 25% per click

	function setIndex(i) {
		if (i >= 0 && i < items.length) {
			selectedIndex = i;
			openMainViewerForSelected();
		}
	}

	// OpenSeadragon dynamic import (client only)
	let OpenSeadragonLib = null;
	function ensureOsd() {
		if (!browser) return Promise.resolve(null);
		if (OpenSeadragonLib) return Promise.resolve(OpenSeadragonLib);
		return import('openseadragon').then((mod) => {
			OpenSeadragonLib = mod.default || mod;
			return OpenSeadragonLib;
		});
	}

	// OpenSeadragon instances and containers
	let viewerEl = $state(null);
	let osdViewer = $state(null);
	let modalViewerEl = $state(null);
	let modalOsdViewer = $state(null);

	function createOrOpenViewer(existing, el, url) {
		if (!el || !url || !OpenSeadragonLib) return existing;
		if (!existing) {
			existing = OpenSeadragonLib({
				element: el,
				showNavigationControl: false, // keep our own UI
				preserveImageSizeOnResize: true,
				visibilityRatio: 1.0,
				constrainDuringPan: false,
				zoomPerScroll: 1.2,
				gestureSettingsMouse: {
					scrollToZoom: true,
					clickToZoom: false,
					dblClickToZoom: true,
					dragToPan: true
				},
				gestureSettingsTouch: {
					pinchToZoom: true,
					dblClickToZoom: false,
					dragToPan: true
				}
			});
		}
		existing.open({ type: 'image', url });
		return existing;
	}

	function openMainViewerForSelected() {
		if (!browser) return;
		ensureOsd().then(() => {
			if (!selected || !viewerEl) return;
			const url = getFormatUrl(selected, 'lg');
			osdViewer = createOrOpenViewer(osdViewer, viewerEl, url);
		});
	}

	function openModalViewerForSelected() {
		if (!browser) return;
		ensureOsd().then(() => {
			if (!selected || !modalViewerEl) return;
			const url = getFormatUrl(selected, 'lg');
			modalOsdViewer = createOrOpenViewer(modalOsdViewer, modalViewerEl, url);
		});
	}

	function zoomIn(viewer = osdViewer) {
		if (viewer) {
			viewer.viewport.zoomBy(1 + zoomStep);
			viewer.viewport.applyConstraints();
		}
	}
	function zoomOut(viewer = osdViewer) {
		if (viewer) {
			viewer.viewport.zoomBy(1 / (1 + zoomStep));
			viewer.viewport.applyConstraints();
		}
	}

	onMount(() => {
		if (!browser) return;
		openMainViewerForSelected();
	});

	// Modal state
	let showModal = $state(false);
	function openModal() {
		showModal = true;
		if (browser) {
			requestAnimationFrame(() => openModalViewerForSelected());
		}
	}
	function closeModal() {
		if (modalOsdViewer) {
			modalOsdViewer.destroy();
			modalOsdViewer = null;
		}
		showModal = false;
	}

	function safeParseFormats(formats) {
		if (!formats) return {};
		if (typeof formats === 'string') {
			try {
				return JSON.parse(formats);
			} catch (e) {
				console.error('Error parsing asset formats:', e);
				return {};
			}
		}
		return formats;
	}

	function getFormatUrl(asset, size = 'sm') {
		const fm = safeParseFormats(asset?.asset_formats);
		const p = fm?.[size] || asset?.asset_path || '';
		return getAssetUrl({ asset_path: p });
	}

	onDestroy(() => {
		if (osdViewer) {
			osdViewer.destroy();
			osdViewer = null;
		}
		if (modalOsdViewer) {
			modalOsdViewer.destroy();
			modalOsdViewer = null;
		}
	});
</script>

<div class="d-flex flex-column">
	<!-- Main image viewer -->
	<div
		class="position-relative bg-white rounded border overflow-hidden mb-3"
		style="height: 520px;"
	>
		<!-- Controls -->
		<div class="position-absolute top-0 start-0 m-2 d-flex gap-2 z-2">
			<button
				class="btn btn-light btn-sm"
				title={t('media.zoom-in')}
				onclick={() => zoomIn()}
				aria-label={t('media.zoom-in')}
			>
				<i class="bi bi-zoom-in"></i>
			</button>
			<button
				class="btn btn-light btn-sm"
				title={t('media.zoom-out')}
				onclick={() => zoomOut()}
				aria-label={t('media.zoom-out')}
			>
				<i class="bi bi-zoom-out"></i>
			</button>
			<button
				class="btn btn-light btn-sm"
				title={t('media.open-modal')}
				onclick={openModal}
				aria-label={t('media.open-fullscreen')}
			>
				<i class="bi bi-arrows-fullscreen"></i>
			</button>
		</div>

		<!-- Image canvas (OpenSeadragon container) -->
		{#if selected}
			<div class="w-100 h-100 d-flex align-items-center justify-content-center bg-light">
				<div
					class="w-100 h-100 d-flex align-items-center justify-content-center"
					style="overflow: hidden;"
				>
					<div bind:this={viewerEl} class="w-100 h-100"></div>
				</div>
			</div>
		{:else}
			<div class="w-100 h-100 d-flex align-items-center justify-content-center text-muted bg-light">
				{t('media.no-image-available')}
			</div>
		{/if}
	</div>

	<!-- Thumbnails strip -->
	<div class="position-relative fade-right">
		<div class="d-flex gap-3 overflow-auto pb-2 pe-5">
			{#each items as a, i}
				<button
					type="button"
					onclick={() => setIndex(i)}
					class="p-0 border-0 bg-transparent flex-shrink-0"
					aria-label={t('media.select-image', { count: i + 1 })}
				>
					<div
						class="rounded bg-white border"
						class:border-secondary={i === selectedIndex}
						class:border-2={i === selectedIndex}
						style="width: 100px; height: 100px;"
					>
						<div
							class="w-100 h-100 d-flex align-items-center justify-content-center overflow-hidden bg-light"
						>
							<img
								src={getFormatUrl(a, 'sm')}
								alt={a.asset_filename || t('media.image-number', { count: i + 1 })}
								style="width: 100%; height: 100%; object-fit: contain;"
							/>
						</div>
					</div>
				</button>
			{/each}
		</div>
	</div>
</div>

<!-- Modal (Bootstrap-styled, no JS dependency) -->
{#if showModal}
	<div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true">
		<div class="modal-dialog modal-xl modal-dialog-centered" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">{t('media.image-preview')}</h5>
					<button type="button" class="btn-close" aria-label={t('common.close')} onclick={closeModal}></button>
				</div>
				<div class="modal-body p-0">
					<div class="position-relative" style="height: 80vh;">
						<!-- Controls inside modal -->
						<div class="position-absolute top-0 start-0 m-2 d-flex gap-2 z-2">
							<button
								class="btn btn-light btn-sm"
								title={t('media.zoom-in')}
								onclick={() => zoomIn(modalOsdViewer)}
								aria-label={t('media.zoom-in')}
							>
								<i class="bi bi-zoom-in"></i>
							</button>
							<button
								class="btn btn-light btn-sm"
								title={t('media.zoom-out')}
								onclick={() => zoomOut(modalOsdViewer)}
								aria-label={t('media.zoom-out')}
							>
								<i class="bi bi-zoom-out"></i>
							</button>
						</div>

						{#if selected}
							<div class="w-100 h-100 d-flex align-items-center justify-content-center bg-light">
								<div
									class="w-100 h-100 d-flex align-items-center justify-content-center"
									style="overflow: hidden;"
								>
									<div bind:this={modalViewerEl} class="w-100 h-100"></div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
	<!-- Modal backdrop click -->
	<div class="modal-backdrop fade show"></div>
{/if}

<style>
	/* Right-end gradient overlay indicating horizontal overflow */
	.fade-right::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 40px;
		height: 100%;
		pointer-events: none;
		z-index: 1;
		background: linear-gradient(to left, rgba(255, 255, 255, 0.9) 10%, rgba(255, 255, 255, 0));
	}
	/* Ensure the overlay sits above scrollbar content if present */
	.fade-right {
		overflow: auto;
	}
</style>
