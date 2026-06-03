<script>
	import { page } from '$app/stores';
	import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';
	import ExportPreviewSection from '$lib/components/export/ExportPreviewSection.svelte';
	import PageActionFooter from '$lib/components/common/PageActionFooter.svelte';

	let { data } = $props();
	const { t } = getTranslationStore();

	let projectId = $derived($page.params.project_id);
	let selectedFormat = $state('csv');
	let includeAssets = $state(false);
	let deselectedObjectIds = $state(new Set());
	let totalCount = $state(0);
	let filtersPayload = $state({});

	const exportFormats = [
		{ value: 'csv', label: 'CSV' },
		{ value: 'json', label: 'JSON' },
		{ value: 'sql', label: 'SQLite' }
	];

	async function handleExport() {
		try {
			if (!window?.api?.exportProject) return;
			const result = await window.api.exportProject(JSON.parse(JSON.stringify({
				filters: {
					...filtersPayload,
					...(deselectedObjectIds.size > 0 && { excludeObjectIds: [...deselectedObjectIds] })
				},
				includeAssets: !!includeAssets,
				format: selectedFormat
			})));
			if (result.canceled) return;
		} catch {
			// intentionally silent
		}
	}

	const exportDisabledReason = $derived.by(() => {
		if (totalCount === 0) return t('export.no-objects-match', { fallback: 'No objects match current filters' });
		if (totalCount - deselectedObjectIds.size <= 0) return t('export.no-objects-selected', { fallback: 'No objects selected' });
		return '';
	});

	const rightActionButtons = $derived.by(() => [
		{
			id: 'export-data',
			text: t('translations.export', { fallback: 'Export' }),
			class: 'btn btn-success',
			disabled: !!exportDisabledReason,
			onClick: handleExport,
			title: exportDisabledReason
		}
	]);
</script>
<PageActionFooter contentClass="export-page container-fluid py-4" rightButtons={rightActionButtons}>
	<div class="col-lg-8">
		<div class="mb-4">
			<h1 class="h3 mb-0">{t('translations.export', { fallback: 'Export' })}</h1>
			<p class="text-muted mt-2 mb-0">
				{t('export.page-description', { fallback: 'Choose the filters to export your dataset.' })}
			</p>
		</div>

		<div class="mb-4">
			<h5 class="h5 mb-2">{t('export.export-as', { fallback: 'Export as' })}</h5>
			<div class="d-flex gap-3">
				{#each exportFormats as format}
					<label class="d-inline-flex align-items-center gap-2 px-3 py-2 border rounded-2 cursor-pointer {selectedFormat === format.value ? 'border border-primary' : ''}">
						<input type="radio" class="form-check-input" bind:group={selectedFormat} value={format.value} />
						<span>{format.label}</span>
						{#if format.value === 'csv'}
							<span class="bi bi-table d-inline-flex align-items-center justify-content-center rounded-2 {selectedFormat === format.value ? 'bg-primary text-white' : 'bg-light text-secondary'}" style="width: 2rem; height: 2rem;"></span>
						{:else if format.value === 'json'}
							<span class="bi bi-braces d-inline-flex align-items-center justify-content-center rounded-2 {selectedFormat === format.value ? 'bg-primary text-white' : 'bg-light text-secondary'}" style="width: 2rem; height: 2rem;"></span>
						{:else if format.value === 'sql'}
							<span class="bi bi-database d-inline-flex align-items-center justify-content-center rounded-2 {selectedFormat === format.value ? 'bg-primary text-white' : 'bg-light text-secondary'}" style="width: 2rem; height: 2rem;"></span>
						{/if}
					</label>
				{/each}
			</div>
		</div>

		<div class="mb-4">
			<label class="d-flex align-items-center gap-2">
				<input type="checkbox" class="form-check-input" bind:checked={includeAssets} />
				<span>{t('export.include-media', { fallback: 'Include media in the export' })}</span>
			</label>
		</div>

		<h5 class="h5 mb-3">{t('export.filter-content', { fallback: 'Filter content' })}</h5>

		<ExportPreviewSection
			{projectId}
			{data}
			bind:deselectedObjectIds
			bind:totalCount
			bind:filtersPayload
		/>
	</div>
</PageActionFooter>
