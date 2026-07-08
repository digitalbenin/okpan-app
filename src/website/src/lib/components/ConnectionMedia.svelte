<script>
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import BaseVideo from '$lib/components/base/BaseVideo.svelte';
	import BaseAudio from '$lib/components/base/BaseAudio.svelte';
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	const { t } = getWebsiteTranslationStore();

	let { mainAssetPath = null, assets = [] } = $props();

	// Build unified mixed media array (images, videos, audio)
	// The mainAssetPath (vocabulary thumbnail) is excluded — it's shown in the header
	const mediaItems = $derived.by(() => {
		const items = [];
		for (const a of (assets || [])) {
			const path = a.path || '';
			const type = a.type || (
				path.match(/\.(mp4|webm|ogg)$/i) ? 'video' :
				path.match(/\.(mp3|wav)$/i) ? 'audio' :
				'image'
			);
			if (mainAssetPath && type === 'image' && path === mainAssetPath) continue;
			items.push({ type, path, id: a.id, formats: a.formats || null });
		}
		return items;
	});

	// Carousel state — single index for all media
	let mediaIndex = $state(0);
	const currentMedia = $derived(mediaItems[mediaIndex] || null);
	function setMediaIndex(i) {
		if (i >= 0 && i < mediaItems.length) {
			mediaIndex = i;
			openCurrentInViewer();
		}
	}

	// --- OpenSeadragon for images ---
	let OpenSeadragonLib = null;
	function ensureOsd() {
		if (!browser) return Promise.resolve(null);
		if (OpenSeadragonLib) return Promise.resolve(OpenSeadragonLib);
		return import('openseadragon').then((mod) => {
			OpenSeadragonLib = mod.default || mod;
			return OpenSeadragonLib;
		});
	}

	let viewerEl = $state(null);
	let osdViewer = $state(null);
	let modalViewerEl = $state(null);
	let modalOsdViewer = $state(null);
	const zoomStep = 0.25;

	function safeParseFormats(formats) {
		if (!formats) return {};
		if (typeof formats === 'string') {
			try { return JSON.parse(formats); } catch { return {}; }
		}
		return formats;
	}

	function getImageUrl(item) {
		const fm = safeParseFormats(item?.formats);
		const p = fm?.lg || item?.path || '';
		return getAssetUrl({ asset_path: p });
	}

	function createOrOpenViewer(existing, el, url) {
		if (!el || !url || !OpenSeadragonLib) return existing;
		if (!existing) {
			existing = OpenSeadragonLib({
				element: el,
				showNavigationControl: false,
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

	function openCurrentInViewer() {
		if (!browser) return;
		if (currentMedia?.type !== 'image') {
			if (osdViewer) {
				osdViewer.destroy();
				osdViewer = null;
			}
			return;
		}
		ensureOsd().then(() => {
			if (!currentMedia || !viewerEl) return;
			const url = getImageUrl(currentMedia);
			osdViewer = createOrOpenViewer(osdViewer, viewerEl, url);
		});
	}

	let showModal = $state(false);
	function openModalViewer() {
		if (!browser || currentMedia?.type !== 'image') return;
		showModal = true;
		if (browser) {
			requestAnimationFrame(() => {
				ensureOsd().then(() => {
					if (!currentMedia || !modalViewerEl) return;
					const url = getImageUrl(currentMedia);
					modalOsdViewer = createOrOpenViewer(modalOsdViewer, modalViewerEl, url);
				});
			});
		}
	}
	function closeModal() {
		if (modalOsdViewer) {
			modalOsdViewer.destroy();
			modalOsdViewer = null;
		}
		showModal = false;
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
		if (mediaItems[0]?.type === 'image') {
			openCurrentInViewer();
		}
	});

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

{#if mediaItems.length > 0}
	<div class="d-flex flex-column gap-2">
		<span class="text-uppercase fs-8 text-body">
			{t('object.media')}
		</span>
		<div class="position-relative bg-white rounded overflow-hidden" style="height: 400px;">
			{#if currentMedia?.type === 'video'}
				<div class="w-100 h-100 d-flex align-items-center justify-content-center bg-black">
					<BaseVideo src={currentMedia.path} assetId={currentMedia.id} class="d-block mw-100 mh-100" />
				</div>
			{:else if currentMedia?.type === 'audio'}
				<div class="w-100 h-100 d-flex align-items-center justify-content-center bg-black">
					<BaseAudio src={currentMedia.path} assetId={currentMedia.id} class="w-75" />
				</div>
			{:else}
				<div class="w-100 h-100 position-relative bg-secondary">
					<div class="position-absolute top-0 start-0 m-2 d-flex gap-2 z-2">
						<button class="btn btn-light btn-sm" onclick={() => zoomIn()} aria-label={t('media.zoom-in')}><i class="bi bi-zoom-in"></i></button>
						<button class="btn btn-light btn-sm" onclick={() => zoomOut()} aria-label={t('media.zoom-out')}><i class="bi bi-zoom-out"></i></button>
						<button class="btn btn-light btn-sm" onclick={openModalViewer} aria-label={t('media.open-fullscreen')}><i class="bi bi-arrows-fullscreen"></i></button>
					</div>
					<div bind:this={viewerEl} class="w-100 h-100"></div>
				</div>
			{/if}
		</div>
		<!-- Thumbnails strip -->
		{#if mediaItems.length > 1}
			<div class="d-flex gap-2 overflow-auto">
				{#each mediaItems as item, i}
					<button type="button" onclick={() => setMediaIndex(i)} class="p-0 border-0 bg-transparent flex-shrink-0">
						<div class="rounded border overflow-hidden" class:border-secondary={i === mediaIndex} class:border-2={i === mediaIndex} style="width: 92px; height: 92px;">
							<div class="w-100 h-100 d-flex align-items-center justify-content-center bg-secondary-subtle">
								{#if item.type === 'video'}
									<i class="bi bi-play-btn fs-2 text-secondary"></i>
								{:else if item.type === 'audio'}
									<i class="bi bi-volume-up fs-2 text-secondary"></i>
								{:else}
									<img src={getAssetUrl({ asset_path: item.path })} alt="" class="w-100 h-100 object-fit-cover" />
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<!-- Modal -->
{#if showModal}
	<div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true">
		<div class="modal-dialog modal-xl modal-dialog-centered" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">{t('media.image-preview')}</h5>
					<button type="button" class="btn-close" aria-label={t('common.close')} onclick={closeModal}></button>
				</div>
				<div class="modal-body p-0">
					<div class="position-relative bg-secondary" style="height: 80vh;">
						<div class="position-absolute top-0 start-0 m-2 d-flex gap-2 z-2">
							<button class="btn btn-light btn-sm" onclick={() => zoomIn(modalOsdViewer)} aria-label={t('media.zoom-in')}><i class="bi bi-zoom-in"></i></button>
							<button class="btn btn-light btn-sm" onclick={() => zoomOut(modalOsdViewer)} aria-label={t('media.zoom-out')}><i class="bi bi-zoom-out"></i></button>
						</div>
						<div bind:this={modalViewerEl} class="w-100 h-100"></div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="modal-backdrop fade show"></div>
{/if}
