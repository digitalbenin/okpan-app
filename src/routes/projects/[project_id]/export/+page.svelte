<script>
	import { page } from '$app/stores';
	import { IconTableExport, IconBulb, IconTable, IconBraces, IconDatabase, IconDownload, IconComponents } from '@tabler/icons-svelte';
	import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';
	import ExportPreviewSection from '$lib/components/export/ExportPreviewSection.svelte';
	import PageActionFooter from '$lib/components/common/PageActionFooter.svelte';
	import BaseAlertDialog from '$lib/components/base/BaseAlertDialog.svelte';

	let { data } = $props();
	const { t } = getTranslationStore();

	let projectId = $derived($page.params.project_id);
	let selectedFormat = $state('csv');
	let includeAssets = $state(false);
	let deselectedObjectIds = $state(new Set());
	let totalCount = $state(0);
	let filtersPayload = $state({});
	let exportResult = $state(null);
	let exportResultDialogOpen = $state(false);

	const exportFormats = [
		{ value: 'csv', label: 'CSV', icon: IconTable },
		{ value: 'json', label: 'JSON', icon: IconBraces },
		{ value: 'sql', label: 'SQL', icon: IconDatabase }
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
			exportResult = result;
			exportResultDialogOpen = true;
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
			iconComponent: IconDownload,
			iconPosition: 'left',
			disabled: !!exportDisabledReason,
			onClick: handleExport,
			title: exportDisabledReason
		}
	]);
</script>


<PageActionFooter contentClass="container-fluid p-0 m-0" rightButtons={rightActionButtons}>
	<!-- Heading section -->
<div class="bg-white border-bottom px-4 py-3 d-flex flex-column gap-2 mx-n4 mt-n4">
	<div class="d-flex flex-column gap-3">
		<div class="d-flex align-items-center gap-3">
			<div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
				<IconTableExport size={32} />
			</div>
			<h1 class="mb-0 flex-grow-1">{t('translations.export', { fallback: 'Export' })}</h1>
		</div>
		<p class="mb-0" style="font-size: 14px;">{t('export.header-subtitle', { fallback: 'Download your project data as a file — to back up, share, or use in another tool.' })}</p>
	</div>
</div>


	<div class="row g-3 mt-3">
		<div class="col-12 col-lg-8 col-xl-9 min-w-0">
			<div class="bg-white rounded-3 p-4 d-flex flex-column gap-1 mb-3">
				<h3 class="fw-normal mb-0" style="font-size: 28px; letter-spacing: -0.56px;">{t('export.subtitle', { fallback: 'Export your data' })}</h3>
				<div class="mt-2" style="font-size: 16px;">
					<p class="mb-0">{t('export.long-description', { fallback: 'Choose the format and filters for your data export. CSV is best for spreadsheets, JSON for APIs, and SQLite for databases.' })}</p>
				</div>
			</div>

			<div class="bg-white rounded-3 p-4 d-flex flex-column gap-3 mb-3">
				<p class="text-uppercase fs-8 fw-normal text-body mb-0" style="letter-spacing: 0.24px;">
					{t('export.export-as', { fallback: 'Select the format' })}
				</p>
				<div class="d-flex gap-3">
					{#each exportFormats as format}
						<label class="d-inline-flex flex-column align-items-center gap-2 px-4 py-3 border rounded-3 cursor-pointer" class:border-primary={selectedFormat === format.value} class:text-primary={selectedFormat === format.value} style="width: 86px;">
							<svelte:component this={format.icon} size={32} stroke={1.5} />
							<div class="d-inline-flex align-items-center gap-2">
								<input type="radio" class="form-check-input mb-1" bind:group={selectedFormat} value={format.value} />
								<span>{format.label}</span>
							</div>
						</label>
					{/each}
				</div>
				<div>
					<label class="d-flex align-items-center gap-2">
					<input type="checkbox" class="form-check-input" bind:checked={includeAssets} />
					<span>{t('export.include-media', { fallback: 'Include media in the export' })}</span>
				</label>
				</div>
			</div>

			<ExportPreviewSection
					{projectId}
					{data}
					bind:deselectedObjectIds
					bind:totalCount
					bind:filtersPayload
				/>
		</div>

		<div class="col-12 col-lg-4 col-xl-3">
			<div class="bg-white border rounded-3 p-4 d-flex flex-column">
				<div class="d-flex flex-column gap-1">
					<div class="flex-shrink-0">
						<IconBulb size={16} stroke={2} />
					</div>
					<div>
						<p class="fw-semibold mb-1 text-body">{t('export.help-title', { fallback: 'How to export?' })}</p>
						<div class="text-body-secondary fs-7">
							<p class="mb-2">{t('export.help-desc-p1', { fallback: 'Select the format and set the export options. All filters and exclusions configured below apply to the export.' })}</p>
							<p class="mb-2">{t('export.help-desc-p2', { fallback: 'Objects excluded from the preview table will not be included in the export file.' })}</p>
							<p class="mb-0">{t('export.help-desc-p3', { fallback: 'You can also use advanced filtering to narrow down which objects to export.' })}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</PageActionFooter>

<BaseAlertDialog bind:open={exportResultDialogOpen} size="md" noClose>
	{#snippet title()}
		{t('export.result-title', { fallback: 'Export completed' })}
	{/snippet}
	{#snippet description()}
		<div class="d-flex flex-column gap-3">
			{#if exportResult?.counts}
				<p class="mb-0">
					{exportResult.counts.objects}
					{t('export.result-description', { fallback: ' objects and their related data were exported' })}
				</p>
			{/if}
			{#if exportResult?.filePath}
				<div>
					{t('export.result-path', { fallback: 'Saved to' })}:
					<code class="ms-1 text-break">{exportResult.filePath}</code>
				</div>
			{/if}
		</div>
	{/snippet}
	{#snippet footer()}
		<button class="btn btn-success" onclick={() => { exportResultDialogOpen = false; }}>
			{t('common.ok', { fallback: 'OK' })}
		</button>
	{/snippet}
</BaseAlertDialog>
