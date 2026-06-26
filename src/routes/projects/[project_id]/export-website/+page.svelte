<script>
	import { page } from '$app/stores';
	import BaseAlertDialog from '$lib/components/base/BaseAlertDialog.svelte';
	import PageActionFooter from '$lib/components/common/PageActionFooter.svelte';
	import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';

	const WEBSITE_LOCALE_MODULES = import.meta.glob('../../../../website/src/lib/i18n/*.json', {
		eager: true
	});

	const { t, translationState } = getTranslationStore();
	let { data } = $props();

	function normalizeLocale(locale) {
		return typeof locale === 'string' ? locale.trim().toLowerCase() : '';
	}

	function resolveWebsiteLocale(locale, availableLanguages) {
		const normalized = normalizeLocale(locale);
		if (!normalized) return '';
		const exactMatch = availableLanguages.find((lang) => lang.code === normalized);
		if (exactMatch) return exactMatch.code;
		const baseMatch = availableLanguages.find((lang) => lang.code === normalized.split('-')[0]);
		return baseMatch?.code || '';
	}

	function setOptionalContentLanguageEnabled(code, enabled) {
		const normalizedCode = normalizeLocale(code);
		if (!normalizedCode) return;
		if (enabled) {
			excludedOptionalContentLanguageCodes = excludedOptionalContentLanguageCodes.filter(
				(c) => c !== normalizedCode
			);
			return;
		}
		if (!excludedOptionalContentLanguageCodes.includes(normalizedCode)) {
			excludedOptionalContentLanguageCodes = [...excludedOptionalContentLanguageCodes, normalizedCode];
		}
	}

	let projectId = $derived($page.params.project_id);
	let isExporting = $state(false);
	let exportStatus = $state(null);
	let exportMessage = $state('');
	let exportPath = $state('');
	let exportResultDialogOpen = $state(false);

	let basePathInput = $state('');
	let websiteLocalePreference = $state('');
	let excludedOptionalContentLanguageCodes = $state([]);

	const websiteSettings = $derived.by(() => {
		const list = $page?.data?.websiteSettings ?? [];
		return list[0] ?? null;
	});

	const websiteLocaleOptions = $derived.by(() => {
		const seen = new Set();
		return Object.values(WEBSITE_LOCALE_MODULES)
			.map((module) => module?.default ?? module)
			.map((bundle) => {
				const code = normalizeLocale(bundle?.code);
				if (!code || seen.has(code)) return null;
				seen.add(code);
				return { code, name: bundle?.name || code };
			})
			.filter(Boolean);
	});

	const contentLanguageOptions = $derived.by(() => {
		const fromData = Array.isArray(data?.contentLanguages) ? data.contentLanguages : [];
		const normalized = fromData
			.map((lang) => {
				const code = normalizeLocale(lang?.code);
				if (!code) return null;
				return { code, name: lang?.name || code, isDefault: Number(lang?.is_default) === 1 };
			})
			.filter(Boolean);
		normalized.sort((a, b) => {
			if (a.isDefault === b.isDefault) return a.code.localeCompare(b.code);
			return a.isDefault ? -1 : 1;
		});
		return normalized;
	});

	const defaultContentLanguage = $derived(
		contentLanguageOptions.find((lang) => lang.isDefault) || contentLanguageOptions[0] || null
	);

	const optionalContentLanguages = $derived(
		defaultContentLanguage
			? contentLanguageOptions.filter((lang) => lang.code !== defaultContentLanguage.code)
			: contentLanguageOptions
	);

	const showContentLanguageSelection = $derived(optionalContentLanguages.length > 0);

	const selectedOptionalContentLanguages = $derived.by(() => {
		const excludedCodes = new Set(
			excludedOptionalContentLanguageCodes.map((code) => normalizeLocale(code))
		);
		return optionalContentLanguages.map((lang) => lang.code).filter((code) => !excludedCodes.has(code));
	});

	const selectedContentLanguageCodes = $derived.by(() => {
		const selectedCodes = new Set();
		if (defaultContentLanguage?.code) selectedCodes.add(defaultContentLanguage.code);
		selectedOptionalContentLanguages.forEach((code) => {
			const normalized = normalizeLocale(code);
			if (normalized) selectedCodes.add(normalized);
		});
		return [...selectedCodes];
	});

	const selectedWebsiteLocale = $derived.by(() => {
		if (websiteLocaleOptions.length === 0) return '';
		return (
			resolveWebsiteLocale(websiteLocalePreference, websiteLocaleOptions) ||
			resolveWebsiteLocale(translationState.currentLocale, websiteLocaleOptions) ||
			websiteLocaleOptions[0]?.code ||
			''
		);
	});

	async function handleExport() {
		isExporting = true;
		exportStatus = null;
		exportMessage = '';
		exportPath = '';

		try {
			const result = await window.api.openFileDialog({
				title: t('export-website.select-folder'),
				properties: ['openDirectory', 'createDirectory']
			});

			if (!result || result.canceled || !result.filePaths?.length) {
				isExporting = false;
				return;
			}

			const outputPath = result.filePaths[0];
			exportPath = outputPath;

const storedFilters = websiteSettings?.filters || {};
		const exportResult = await window.api.exportStaticWebsite(JSON.parse(JSON.stringify({
			projectId,
			outputPath,
			locale: selectedWebsiteLocale,
			filters: {
				...(storedFilters || {}),
				contentLanguageCodes: [...selectedContentLanguageCodes]
				}
			})));

			exportPath = exportResult?.outputPath || outputPath;
			exportStatus = 'success';
			exportMessage = t('export-website.success');
			exportResultDialogOpen = true;
		} catch (error) {
			console.error('Export failed:', error);
			exportStatus = 'error';
			exportMessage = error.message || t('export-website.error');
		} finally {
			isExporting = false;
		}
	}

	const exportDisabledReason = $derived.by(() => {
		if (websiteLocaleOptions.length === 0) return t('export-website.interface-language-empty');
		return '';
	});

	const rightActionButtons = $derived.by(() => [
		{
			id: 'export-website',
			text: isExporting ? t('export-website.exporting') : t('export-website.button'),
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
			<h1 class="h3 mb-0">{t('export-website.title')}</h1>
		</div>
	</div>
	<div class="row">
		<div class="col-8">
			<div class="card shadow-sm mb-4">
				<div class="card-body">
					<h5 class="card-title mb-3">{t('export-website.subtitle')}</h5>
					<p class="card-text text-muted mb-4">{t('export-website.description')}</p>
					<div class="mb-0">
						<h6 class="fw-semibold mb-2">{t('export-website.what-included')}</h6>
						<ul class="text-muted mb-0">
							<li>{t('export-website.include-objects')}</li>
							<li>{t('export-website.include-assets')}</li>
							<li>{t('export-website.include-fields')}</li>
							<li>{t('export-website.include-settings')}</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="mb-4">
				<h5 class="card-title mb-3">{t('export-website.languages-title')}</h5>

				<h6 class="fw-semibold mb-2">{t('export-website.interface-language-title')}</h6>
				<p class="small mb-2">{t('export-website.interface-language-description')}</p>
				<label class="form-label" for="website-export-language-select">
					{t('export-website.interface-language-label')}
				</label>
				<select
					id="website-export-language-select"
					class="form-select"
					value={selectedWebsiteLocale}
					onchange={(event) => { websiteLocalePreference = event.currentTarget.value; }}
					disabled={websiteLocaleOptions.length === 0}
				>
					{#each websiteLocaleOptions as language (language.code)}
						<option value={language.code}>{language.name}</option>
					{/each}
				</select>
				{#if websiteLocaleOptions.length === 0}
					<p class="small mt-2 mb-0">{t('export-website.interface-language-empty')}</p>
				{/if}

				{#if showContentLanguageSelection}
					<div class="mt-4">
						<h6 class="fw-semibold mb-2">{t('export-website.content-languages-title')}</h6>
						<p class="small mb-2">{t('export-website.content-languages-description')}</p>

						<div class="form-check mb-2">
							<input
								id="default-content-language"
								class="form-check-input"
								type="checkbox"
								checked={true}
								disabled={true}
							/>
							<label class="form-check-label" for="default-content-language">
								{t('export-website.default-content-language-label', {
									name: defaultContentLanguage?.name || defaultContentLanguage?.code || ''
								})}
							</label>
						</div>

						{#each optionalContentLanguages as language (language.code)}
							<div class="form-check mb-2">
								<input
									id={`content-language-${language.code}`}
									class="form-check-input"
									type="checkbox"
									checked={selectedOptionalContentLanguages.includes(language.code)}
									onchange={(event) => {
										setOptionalContentLanguageEnabled(language.code, event.currentTarget.checked);
									}}
								/>
								<label class="form-check-label" for={`content-language-${language.code}`}>
									{language.name}
								</label>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="mb-4">
				<h5 class="card-title mb-3">{t('export-website.base-path-title')}</h5>
				<p class="text-muted small">{t('export-website.base-path-description')}</p>
				<div class="input-group">
					<span class="input-group-text" id="basepath-addon">{t('export-website.base-path-label')}</span>
					<input
						type="text"
						class="form-control"
						placeholder="/"
						aria-label={t('export-website.base-path-label')}
						aria-describedby="basepath-addon"
						bind:value={basePathInput}
					/>
				</div>
			</div>

			<h5 class="h5 mb-3">{t('export.filter-content')}</h5>
			<p class="text-muted small">{t('website-settings.filter-from-settings', { fallback: 'Filtering is configured on the Website Settings page. Go to Website Settings to choose which objects to include.' })}</p>
		</div>
	</div>
</PageActionFooter>

<BaseAlertDialog bind:open={exportResultDialogOpen} size="lg">
	{#snippet title()}
		{t('export-website.success')}
	{/snippet}
	{#snippet description()}
		<div class="d-flex flex-column gap-3">
			<div class="small text-muted">
				{t('export-website.exported-to')}
				<code class="ms-1">{exportPath}</code>
			</div>

			<div>
				<h6 class="fw-semibold mb-2">{t('export-website.next-steps')}</h6>
				<ol class="text-muted small mb-0">
					<li>{t('export-website.step1')}</li>
					<li>{t('export-website.step2')}</li>
					<li>{t('export-website.step3')}</li>
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
