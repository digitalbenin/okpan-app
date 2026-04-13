<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { searchObjects } from '$lib/stores/ObjectsUtils.js';
	import PreviewTable from '$lib/components/export/PreviewTable.svelte';
	import StatusFilter from '$lib/components/export/StatusFilter.svelte';
	import InstitutionFilter from '$lib/components/export/InstitutionFilter.svelte';
	import ConnectionFilters from '$lib/components/export/ConnectionFilters.svelte';
	import ResearchFieldFilters from '$lib/components/export/ResearchFieldFilters.svelte';
	import PageActionFooter from '$lib/components/common/PageActionFooter.svelte';
	import BaseAlertDialog from '$lib/components/base/BaseAlertDialog.svelte';
	import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';

	const { t } = getTranslationStore();
	let { data } = $props();

	let projectId = $derived($page.params.project_id);
	let isExporting = $state(false);
	let isLoading = $state(false);
	let exportStatus = $state(null); // null | 'success' | 'error'
	let exportMessage = $state('');
	let exportPath = $state('');
	let exportResultDialogOpen = $state(false);

	let basePathInput = $state('');

	let selectedStatus = $state('all');
	let selectedInstitutions = $state([]);
	let connectionFilters = $state([]);
	let freeTextFilters = $state([]);

	let currentPage = $state(1);
	let _prevPage = $state(1);
	let pageSize = $state(10);
	let objects = $state([]);
	let totalCount = $state(0);
	let deselectedObjectIds = $state(new Set());
	let facets = $state({ institutions: [], statuses: [], researchFields: [] });

	$effect(() => {
		if (currentPage !== _prevPage) {
			_prevPage = currentPage;
			performSearch();
		}
	});

	onMount(() => {
		performSearch();
	});

	let connectionFields = $derived.by(() => {
		const fields = data.connectionFields;
		if (Array.isArray(fields)) return fields;
		return [];
	});

	let freeTextFields = $derived.by(() => {
		const fields = data.freeTextFields;
		if (Array.isArray(fields)) return fields;
		return [];
	});

	let connectionFieldOptions = $derived.by(() => {
		return connectionFields.map((field) => {
			const name = field?.name;
			const label =
				typeof name === 'string'
					? name
					: (name?.content ??
						(Array.isArray(name?.translations) && name.translations[0]?.content) ??
						String(field.id));

			return {
				value: field.id,
				label,
				group: field?.project?.title?.content ?? 'Connections',
				vocabOptions: Array.isArray(field?.vocabularies)
					? field.vocabularies.map((v) => ({
							value: v.id,
							label: v?.option?.content ?? v.id
						}))
					: []
			};
		});
	});

	let freeTextFieldOptions = $derived.by(() => {
		return freeTextFields.map((field) => {
			const name = field?.name;
			const label =
				typeof name === 'string'
					? name
					: (name?.content ??
						(Array.isArray(name?.translations) && name.translations[0]?.content) ??
						String(field.id));

			return {
				value: field.id,
				label,
				group: field?.project?.title?.content ?? 'Research Fields'
			};
		});
	});

	function sanitizeConnectionFilters(filters) {
		if (!Array.isArray(filters) || filters.length === 0) return [];

		return filters.map((filter) => {
			const allowed = (
				connectionFieldOptions.find((option) => option.value === filter.fieldId)?.vocabOptions || []
			).map((option) => option.value);

			const vocabularyIds = (
				Array.isArray(filter.vocabularyIds) ? filter.vocabularyIds : []
			).filter((id) => allowed.includes(id));

			return {
				fieldId: filter.fieldId,
				vocabularyIds
			};
		});
	}

	function sanitizeFreeTextFilters(filters) {
		if (!Array.isArray(filters) || filters.length === 0) return [];

		return filters
			.filter((filter) => filter.query && filter.query.trim())
			.map((filter) => ({
				fieldId: filter.fieldId,
				query: filter.query.trim()
			}));
	}

	function buildCommonFilters() {
		const filters = {
			project_id: projectId,
			...(selectedStatus !== 'all' && { status: selectedStatus }),
			...(selectedInstitutions.length > 0 && { institutionIds: [...selectedInstitutions] })
		};

		const allResearchFieldFilters = [
			...sanitizeConnectionFilters(connectionFilters),
			...sanitizeFreeTextFilters(freeTextFilters)
		];

		if (allResearchFieldFilters.length > 0) {
			filters.researchFieldFilters = allResearchFieldFilters;
		}

		return filters;
	}

	function buildSearchParams() {
		const params = {
			projectId,
			page: currentPage - 1,
			pageSize,
			...(selectedStatus !== 'all' && { status: selectedStatus }),
			...(selectedInstitutions.length > 0 && { institutionIds: [...selectedInstitutions] })
		};

		const allResearchFieldFilters = [
			...sanitizeConnectionFilters(connectionFilters),
			...sanitizeFreeTextFilters(freeTextFilters)
		];

		if (allResearchFieldFilters.length > 0) {
			params.researchFieldFilters = allResearchFieldFilters;
		}

		return params;
	}

	async function performSearch() {
		isLoading = true;
		try {
			const response = await searchObjects(buildSearchParams());
			if (response.error) {
				objects = [];
				totalCount = 0;
				facets = { institutions: [], statuses: [], researchFields: [] };
			} else {
				objects = response.items || [];
				totalCount = response.totalCount || 0;
				facets = response.facets || { institutions: [], statuses: [], researchFields: [] };
			}
		} catch {
			objects = [];
			totalCount = 0;
			facets = { institutions: [], statuses: [], researchFields: [] };
		} finally {
			isLoading = false;
		}
	}

	function onStatusChanged(newStatus) {
		selectedStatus = newStatus;
		currentPage = 1;
		performSearch();
	}

	function onInstitutionsChanged(newInstitutions) {
		selectedInstitutions = Array.isArray(newInstitutions) ? newInstitutions : [];
		currentPage = 1;
		performSearch();
	}

	function onConnectionFiltersChanged(newFilters) {
		connectionFilters = Array.isArray(newFilters) ? newFilters : [];
		currentPage = 1;
		performSearch();
	}

	function onFreeTextFiltersChanged(newFilters) {
		freeTextFilters = Array.isArray(newFilters) ? newFilters : [];
		currentPage = 1;
		performSearch();
	}

	async function handleExport() {
		isExporting = true;
		exportStatus = null;
		exportMessage = '';
		exportPath = '';

		try {
			// Open folder picker
			const result = await window.api.openFileDialog({
				title: 'Select Export Folder',
				properties: ['openDirectory', 'createDirectory']
			});

			if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
				isExporting = false;
				return;
			}

			const outputPath = result.filePaths[0];
			exportPath = outputPath;
			const excludeIds = Array.from(deselectedObjectIds);

			// Call export API
			await window.api.exportStaticWebsite({
				projectId,
				outputPath,
				filters: {
					...buildCommonFilters(),
					...(excludeIds.length > 0 && { excludeObjectIds: excludeIds })
				}
			});

			exportStatus = 'success';
			exportMessage = t('export-website.success', {
				fallback: 'Website exported successfully!'
			});
			exportResultDialogOpen = true;
		} catch (error) {
			console.error('Export failed:', error);
			exportStatus = 'error';
			exportMessage =
				error.message ||
				t('export-website.error', { fallback: 'Failed to export website. Please try again.' });
		} finally {
			isExporting = false;
		}
	}

	let exportSummary = $derived(`Objects matching filters: ${totalCount}`);
	let completedCount = $derived(
		facets?.statuses?.find((status) => (status.id ?? status.name) === 'completed')?.count || 0
	);
	let inProgressCount = $derived(
		facets?.statuses?.find((status) => (status.id ?? status.name) === 'in progress')?.count || 0
	);

	const exportDisabledReason = $derived.by(() => {
		if (isLoading) return '';
		if (totalCount === 0) return 'No objects match current filters';
		if (totalCount - deselectedObjectIds.size <= 0) return 'No objects selected';
		return '';
	});

	const rightActionButtons = $derived.by(() => [
		{
			id: 'export-website',
			text: isExporting
				? t('export-website.exporting', { fallback: 'Exporting...' })
				: t('export-website.button', { fallback: 'Export Website' }),
			class: `btn btn-primary ${isExporting ? 'exporting-button' : ''}`,
			icon: isExporting ? 'arrow-repeat' : 'download',
			loading: false,
			disabled: isExporting || !!exportDisabledReason,
			title: exportDisabledReason,
			onClick: handleExport
		}
	]);
</script>

<PageActionFooter contentClass="container-fluid py-4" rightButtons={rightActionButtons}>
	
	

	<div class="row mb-4">
		<div class="col-12">
			<h1 class="h3 mb-0">
				{t('export-website.title', { fallback: 'Export Static Website' })}
			</h1>
		</div>
	</div>
	<div class="row">
		<div class="col-8">
			<div class="card shadow-sm mb-4">
				<div class="card-body">
					<h5 class="card-title mb-3">
						{t('export-website.subtitle', { fallback: 'Generate Static Website' })}
					</h5>

					<p class="card-text text-muted mb-4">
						{t('export-website.description', {
							fallback:
								'Export your project data as a static website that can be hosted on any web server. The export includes all entities and configurations set in your website settings.'
						})}
					</p>

					<div class="mb-0">
						<h6 class="fw-semibold mb-2">
							{t('export-website.what-included', { fallback: 'What will be included:' })}
						</h6>
						<ul class="text-muted mb-0">
							<li>
								{t('export-website.include-objects', {
									fallback: 'Objects and institutions, along with their metadata'
								})}
							</li>
							<li>
								{t('export-website.include-assets', { fallback: 'Project media (images, videos, audios)' })}
							</li>
							<li>
								{t('export-website.include-fields', {
									fallback: 'Connections, research fields and institutional data'
								})}
							</li>
							<li>
								{t('export-website.include-settings', {
									fallback: 'Website configuration and branding'
								})}
							</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="mb-4">

				<div class="baspath-section mb-4">
				<h5 class="card-title mb-3">Hosting Subdirectory (optional)</h5>
					<p class="text-muted small">If hosting on a sub-path (e.g., GitHub Pages <code>https://user.github.io/my-site</code>), enter <code>/my-site</code>. Leave empty if hosting at the root domain.</p>
					<div class="input-group">
						<span class="input-group-text" id="basepath-addon">Base path</span>
						<input type="text" class="form-control" placeholder="/" aria-label="Base Path" aria-describedby="basepath-addon" bind:value={basePathInput}>
					</div>
				</div>


				<h5 class="h5 mb-3">Filter content</h5>

				<StatusFilter
					bind:selectedStatus
					{completedCount}
					{inProgressCount}
					onChange={onStatusChanged}
				/>

				<InstitutionFilter
					items={data.institutions}
					bind:selectedInstitutions
					onChange={onInstitutionsChanged}
				/>

				<ConnectionFilters
					{connectionFieldOptions}
					bind:connectionFilters
					onChange={onConnectionFiltersChanged}
				/>

				<ResearchFieldFilters
					{freeTextFieldOptions}
					bind:freeTextFilters
					onChange={onFreeTextFiltersChanged}
				/>
			</div>

			<div class="results-section mt-4 mb-4">
				<div class="summary d-flex align-items-center justify-content-between mb-3">
					<div class="summary-left">
						<div class="summary-text text-body">{exportSummary}</div>
					</div>
				</div>

				<PreviewTable
					{objects}
					bind:deselectedObjectIds
					bind:page={currentPage}
					{pageSize}
					count={totalCount}
				/>
			</div>

			
		</div>
	</div>
</PageActionFooter>

<BaseAlertDialog bind:open={exportResultDialogOpen} size="lg">
	{#snippet title()}
		{t('export-website.success', { fallback: 'Website exported successfully!' })}
	{/snippet}
	{#snippet description()}
		<div class="d-flex flex-column gap-3">
			<div class="small text-muted">
				{t('export-website.exported-to', { fallback: 'Exported to:' })}
				<code class="ms-1">{exportPath}</code>
			</div>

			<div>
				<h6 class="fw-semibold mb-2">
					{t('export-website.next-steps', { fallback: 'Next Steps:' })}
				</h6>
				<ol class="text-muted small mb-0">
					<li>
						{t('export-website.step1', {
							fallback: 'Upload the exported folder to your web hosting service'
						})}
					</li>
					<li>
						{t('export-website.step2', {
							fallback: 'Configure your web server to serve the static files'
						})}
					</li>
					<li>
						{t('export-website.step3', {
							fallback: 'Your website will be accessible at your domain'
						})}
					</li>
				</ol>
			</div>
		</div>
	{/snippet}
</BaseAlertDialog>

<style>
	code {
		background-color: rgba(0, 0, 0, 0.05);
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
	}

	:global(.exporting-button .bi-arrow-repeat) {
		animation: export-spin 1s linear infinite;
	}

	@keyframes export-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
