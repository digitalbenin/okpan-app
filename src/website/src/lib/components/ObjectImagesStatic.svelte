<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	const { assets = [] } = $props();
	const { t } = getWebsiteTranslationStore();

	// Filter valid assets and sort by order
	const items = $derived.by(() => 
		(assets || [])
			.filter((a) => a && a.asset_path)
			.sort((a, b) => (a.order || 0) - (b.order || 0))
	);

	function safeParseFormats(formats) {
		if (!formats) return {};
		if (typeof formats === 'string') {
			try {
				return JSON.parse(formats);
			} catch (e) {
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

	// Build JSON array of image URLs for the vanilla JS to consume
	const imageData = $derived.by(() => {
		return items.map((a, i) => ({
			sm: getFormatUrl(a, 'sm'),
			lg: getFormatUrl(a, 'lg'),
			original: getFormatUrl(a, 'original')
		}));
	});

	// Serialized for embedding in HTML
	const imageDataJson = $derived(JSON.stringify(imageData));
</script>

<!-- Container with data attribute for vanilla JS -->
<div class="osd-container d-flex flex-column" data-images={imageDataJson}>
	<!-- Main image viewer -->
	<div
		class="position-relative bg-white rounded border overflow-hidden mb-3"
		style="height: 520px;"
	>
		<!-- Controls -->
		<div class="position-absolute top-0 start-0 m-2 d-flex gap-2 z-2">
			<button
				class="btn btn-light btn-sm osd-zoom-in"
				title={t('media.zoom-in')}
				aria-label={t('media.zoom-in')}
			>
				<i class="bi bi-zoom-in"></i>
			</button>
			<button
				class="btn btn-light btn-sm osd-zoom-out"
				title={t('media.zoom-out')}
				aria-label={t('media.zoom-out')}
			>
				<i class="bi bi-zoom-out"></i>
			</button>
			<button
				class="btn btn-light btn-sm osd-fullscreen"
				title={t('media.open-modal')}
				aria-label={t('media.open-fullscreen')}
			>
				<i class="bi bi-arrows-fullscreen"></i>
			</button>
		</div>

		<!-- Image canvas (OpenSeadragon container) -->
		{#if items.length > 0}
			<div class="osd-viewer w-100 h-100"></div>
		{:else}
			<div class="w-100 h-100 d-flex align-items-center justify-content-center text-muted bg-light">
				{t('media.no-image-available')}
			</div>
		{/if}
	</div>

	<!-- Thumbnails strip -->
	{#if items.length > 1}
		<div class="position-relative fade-right">
			<div class="d-flex gap-3 overflow-auto pb-2 pe-5 osd-thumbnails">
				{#each items as a, i}
					<button
						type="button"
						class="osd-thumb p-0 border-0 bg-transparent flex-shrink-0"
						data-index={i}
						aria-label={t('media.select-image', { count: i + 1 })}
					>
						<div
							class="rounded bg-white border thumb-container"
							class:border-secondary={i === 0}
							class:border-2={i === 0}
							style="width: 100px; height: 100px;"
						>
							<div class="w-100 h-100 d-flex align-items-center justify-content-center overflow-hidden bg-light">
								<img
									src={getFormatUrl(a, 'sm')}
									alt={t('media.image-number', { count: i + 1 })}
									style="width: 100%; height: 100%; object-fit: contain;"
								/>
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Modal (inside container for scoping) -->
	<div class="modal fade osd-modal" tabindex="-1" role="dialog" aria-modal="true">
		<div class="modal-dialog modal-xl modal-dialog-centered" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">{t('media.image-preview')}</h5>
					<button type="button" class="btn-close osd-modal-close" aria-label={t('common.close')}></button>
				</div>
				<div class="modal-body p-0">
					<div class="position-relative" style="height: 80vh;">
						<div class="position-absolute top-0 start-0 m-2 d-flex gap-2 z-2">
							<button class="btn btn-light btn-sm osd-modal-zoom-in" title={t('media.zoom-in')} aria-label={t('media.zoom-in')}>
								<i class="bi bi-zoom-in"></i>
							</button>
							<button class="btn btn-light btn-sm osd-modal-zoom-out" title={t('media.zoom-out')} aria-label={t('media.zoom-out')}>
								<i class="bi bi-zoom-out"></i>
							</button>
						</div>
						<div class="osd-modal-viewer w-100 h-100"></div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="modal-backdrop fade osd-modal-backdrop" style="display: none;"></div>
</div>

<svelte:head>
	<!-- Load OpenSeadragon from CDN -->
	<script src="https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/openseadragon.min.js"></script>
	{@html `<script>
(function() {
	function initOSD() {
		if (typeof OpenSeadragon === 'undefined') {
			setTimeout(initOSD, 50);
			return;
		}
		
		document.querySelectorAll('.osd-container').forEach(function(container) {
			if (container.dataset.osdInit) return;
			container.dataset.osdInit = 'true';
			
			var images = [];
			try {
				images = JSON.parse(container.dataset.images || '[]');
			} catch(e) {}
			
			if (!images.length) return;
			
			var currentIndex = 0;
			var viewer = null;
			var modalViewer = null;
			var zoomStep = 0.25;
			
			var viewerEl = container.querySelector('.osd-viewer');
			var modal = container.querySelector('.osd-modal');
			var backdrop = container.querySelector('.osd-modal-backdrop');
			var modalViewerEl = container.querySelector('.osd-modal-viewer');
			
			function createViewer(element, url) {
				return OpenSeadragon({
					element: element,
					showNavigationControl: false,
					preserveImageSizeOnResize: true,
					visibilityRatio: 1.0,
					constrainDuringPan: false,
					zoomPerScroll: 1.2,
					tileSources: { type: 'image', url: url },
					gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true, dragToPan: true },
					gestureSettingsTouch: { pinchToZoom: true, dblClickToZoom: false, dragToPan: true }
				});
			}
			
			function openImage(index) {
				if (index < 0 || index >= images.length) return;
				currentIndex = index;
				var url = images[index].lg || images[index].original;
				
				if (viewer) {
					viewer.open({ type: 'image', url: url });
				} else if (viewerEl) {
					viewer = createViewer(viewerEl, url);
				}
				
				container.querySelectorAll('.osd-thumb .thumb-container').forEach(function(t, i) {
					t.classList.toggle('border-secondary', i === index);
					t.classList.toggle('border-2', i === index);
				});
			}
			
			function openModal() {
				if (!modal || !backdrop) return;
				modal.classList.add('show');
				modal.style.display = 'block';
				backdrop.classList.add('show');
				backdrop.style.display = 'block';
				document.body.classList.add('modal-open');
				
				setTimeout(function() {
					var url = images[currentIndex].lg || images[currentIndex].original;
					if (modalViewerEl) {
						if (modalViewer) {
							modalViewer.open({ type: 'image', url: url });
						} else {
							modalViewer = createViewer(modalViewerEl, url);
						}
					}
				}, 100);
			}
			
			function closeModal() {
				if (!modal || !backdrop) return;
				modal.classList.remove('show');
				modal.style.display = 'none';
				backdrop.classList.remove('show');
				backdrop.style.display = 'none';
				document.body.classList.remove('modal-open');
				if (modalViewer) {
					modalViewer.destroy();
					modalViewer = null;
				}
			}
			
			// Initialize
			openImage(0);
			
			// Event listeners
			var zoomIn = container.querySelector('.osd-zoom-in');
			var zoomOut = container.querySelector('.osd-zoom-out');
			var fullscreen = container.querySelector('.osd-fullscreen');
			var modalClose = container.querySelector('.osd-modal-close');
			var modalZoomIn = container.querySelector('.osd-modal-zoom-in');
			var modalZoomOut = container.querySelector('.osd-modal-zoom-out');
			
			if (zoomIn) zoomIn.onclick = function() { if (viewer) viewer.viewport.zoomBy(1 + zoomStep); };
			if (zoomOut) zoomOut.onclick = function() { if (viewer) viewer.viewport.zoomBy(1 / (1 + zoomStep)); };
			if (fullscreen) fullscreen.onclick = openModal;
			if (modalClose) modalClose.onclick = closeModal;
			if (backdrop) backdrop.onclick = closeModal;
			if (modalZoomIn) modalZoomIn.onclick = function() { if (modalViewer) modalViewer.viewport.zoomBy(1 + zoomStep); };
			if (modalZoomOut) modalZoomOut.onclick = function() { if (modalViewer) modalViewer.viewport.zoomBy(1 / (1 + zoomStep)); };
			
			container.querySelectorAll('.osd-thumb').forEach(function(thumb) {
				thumb.onclick = function() {
					var idx = parseInt(thumb.dataset.index, 10);
					openImage(idx);
				};
			});
		});
	}
	
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initOSD);
	} else {
		initOSD();
	}
})();
<\/script>`}
</svelte:head>
