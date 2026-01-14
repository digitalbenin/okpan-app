<script>
	import { page } from '$app/stores';
	import PageActionFooter from '$lib/components/common/PageActionFooter.svelte';
	import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';

	const { t } = getTranslationStore();

	let projectId = $derived($page.params.project_id);
	let isExporting = $state(false);
	let exportStatus = $state(null); // null | 'success' | 'error'
	let exportMessage = $state('');
	let exportPath = $state('');

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

			// Call export API
			await window.api.exportStaticWebsite({
				projectId,
				outputPath
			});

			exportStatus = 'success';
			exportMessage = t('export-website.success', {
				fallback: 'Website exported successfully!'
			});
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

	const rightActionButtons = $derived([
		{
			id: 'export-website',
			text: isExporting
				? t('export-website.exporting', { fallback: 'Exporting...' })
				: t('export-website.button', { fallback: 'Export Website' }),
			class: 'btn btn-primary',
			icon: isExporting ? null : 'download',
			loading: isExporting,
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

			<div class="card shadow-sm">
				<div class="card-body">
					<h5 class="card-title mb-3">
						{t('export-website.subtitle', { fallback: 'Generate Static Website' })}
					</h5>

					<p class="card-text text-muted mb-4">
						{t('export-website.description', {
							fallback:
								'Export your project data as a static website that can be hosted on any web server. The export includes all objects, research fields, and assets configured in your website settings.'
						})}
					</p>

					<div class="mb-4">
						<h6 class="fw-semibold mb-2">
							{t('export-website.what-included', { fallback: 'What will be included:' })}
						</h6>
						<ul class="text-muted">
							<li>
								{t('export-website.include-objects', {
									fallback: 'All objects and their associated data'
								})}
							</li>
							<li>
								{t('export-website.include-assets', { fallback: 'Project assets and images' })}
							</li>
							<li>
								{t('export-website.include-fields', {
									fallback: 'Research fields and ontology mappings'
								})}
							</li>
							<li>
								{t('export-website.include-settings', {
									fallback: 'Website configuration and branding'
								})}
							</li>
						</ul>
					</div>

					{#if exportStatus === 'success'}
						<div class="alert alert-success mb-3" role="alert">
							<div class="d-flex flex-column">
								<div class="fw-semibold mb-2">{exportMessage}</div>
								<div class="small text-muted">
									{t('export-website.exported-to', { fallback: 'Exported to:' })}
									<code class="ms-1">{exportPath}</code>
								</div>
							</div>
						</div>
					{/if}

					{#if exportStatus === 'error'}
						<div class="alert alert-danger mb-3" role="alert">
							{exportMessage}
						</div>
					{/if}

					{#if isExporting}
						<div class="mt-3">
							<p class="text-muted small mb-2">
								{t('export-website.please-wait', {
									fallback: 'This may take a few minutes depending on your project size...'
								})}
							</p>
						</div>
					{/if}

					{#if exportStatus === 'success'}
						<div class="mt-4">
							<h6 class="fw-semibold mb-2">
								{t('export-website.next-steps', { fallback: 'Next Steps:' })}
							</h6>
							<ol class="text-muted small">
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
					{/if}
				</div>
			</div>
		</div>
	</div>
</PageActionFooter>

<style>
	code {
		background-color: rgba(0, 0, 0, 0.05);
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
	}
</style>
