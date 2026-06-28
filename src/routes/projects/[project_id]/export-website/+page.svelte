<script>
	import { page } from '$app/stores';
	import { IconWorldUpload, IconBulb } from '@tabler/icons-svelte';
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

	const websiteSettings = $derived.by(() => {
		const list = data?.websiteSettings ?? [];
		return list[0] ?? null;
	});
	let isExporting = $state(false);
	let exportStatus = $state(null);
	let exportMessage = $state('');
	let exportPath = $state('');
	let exportResultDialogOpen = $state(false);

	let basePathInput = $state('');
	let websiteLocalePreference = $state('');
	let excludedOptionalContentLanguageCodes = $state([]);

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
			const exportResult = await window.api.exportStaticWebsite(
				JSON.parse(
					JSON.stringify({
						projectId,
						outputPath,
						locale: selectedWebsiteLocale,
						filters: {
							...(storedFilters || {}),
							contentLanguageCodes: [...selectedContentLanguageCodes]
						}
					})
				)
			);

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
			class: `btn btn-primary`,
			icon: isExporting ? 'arrow-repeat' : 'download',
			disabled: isExporting || !!exportDisabledReason,
			title: exportDisabledReason,
			onClick: handleExport,
			noSuccessFlash: true
		}
	]);
</script>


<!-- Heading section -->
	<div class="bg-white border-bottom px-4 py-3 d-flex flex-column gap-2 mx-n4 mt-n4">
		<div class="d-flex flex-column gap-3">
			<div class="d-flex align-items-center gap-3">
				<div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
					<IconWorldUpload size={32} />
				</div>
				<h1 class="mb-0 flex-grow-1">{t('export-website.title')}</h1>
			</div>
			<p class="fs-7 mb-0">{t('export-website.description')}</p>
		</div>
	</div>

<PageActionFooter contentClass="container-fluid py-4" rightButtons={rightActionButtons}>
	

	<!-- Main content -->
	<div class="row g-3">
		<div class="col-12 col-lg-8 col-xl-9 min-w-0">
			<!-- Card 1: Generate static website -->
			<div class="bg-white rounded-3 p-4 d-flex flex-column gap-1">
				<h3 class="fw-normal mb-0">{t('export-website.subtitle')}</h3>
				<div class="mt-2">
					<p class="mb-2">{t('export-website.long-description')}</p>
					<p class="mb-2 fw-semibold text-body">{t('export-website.what-included')}</p>
					<ul class="mb-2">
						<li class="mb-0">{t('export-website.include-objects')}</li>
						<li class="mb-0">{t('export-website.include-assets')}</li>
						<li class="mb-0">{t('export-website.include-fields')}</li>
						<li class="mb-0">{t('export-website.include-settings')}</li>
					</ul>
					<p class="mb-0">{t('export-website.filter-hint')}</p>
				</div>
			</div>

			<!-- Card 2: Options -->
			<div class="bg-white rounded-3 p-4 d-flex flex-column gap-3">
				<p class="text-uppercase fs-8 fw-normal text-body mb-0">
					{t('export-website.options-title')}
				</p>
				<div class="d-flex flex-column gap-4">
					<!-- Interface language -->
					<div>
						<label class="form-label fw-normal mb-2" for="website-export-language-select">
							{t('export-website.interface-language-title')}
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
						<div class="form-text mt-2">{t('export-website.interface-language-description')}</div>
						{#if websiteLocaleOptions.length === 0}
							<p class="fs-7 mt-1 mb-0">{t('export-website.interface-language-empty')}</p>
						{/if}
					</div>

					<!-- Content languages (kept per user request) -->
					{#if showContentLanguageSelection}
						<div>
							<label class="form-label fw-normal mb-2">{t('export-website.content-languages-title')}</label>
							<p class="fs-7 mb-2">{t('export-website.content-languages-description')}</p>
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

					<!-- Hosting subdirectory -->
					<div>
						<label class="form-label fw-normal mb-2" for="export-base-path">
							{t('export-website.base-path-title')}
						</label>
						<div class="input-group">
							<span class="input-group-text" id="basepath-addon">{t('export-website.base-path-label')} /</span>
							<input
								id="export-base-path"
								type="text"
								class="form-control"
								aria-label={t('export-website.base-path-label')}
								aria-describedby="basepath-addon"
								bind:value={basePathInput}
							/>
						</div>
						<div class="form-text mt-2">{t('export-website.base-path-description')}</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Right sidebar: help card -->
		<div class="col-12 col-lg-4 col-xl-3">
			<div class="bg-white border rounded-3 p-4 d-flex flex-column">
				<div class="d-flex flex-column gap-1">
					<div class="flex-shrink-0">
						<IconBulb size={16} stroke={2} />
					</div>
					<div>
						<p class="fw-semibold mb-1">{t('export-website.help-title')}</p>
						<div class="fs-7">
							<p class="mb-2">{t('export-website.help-desc-p1')}</p>
							<p class="mb-0">{t('export-website.help-desc-p2')}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</PageActionFooter>

<BaseAlertDialog bind:open={exportResultDialogOpen} size="lg" noClose>
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
				<p class="fw-semibold mb-2">{t('export-website.next-steps')}</p>
				<ol class="text-muted small mb-0">
					<li>{t('export-website.step1')}</li>
					<li>{t('export-website.step2')}</li>
					<li>{t('export-website.step3')}</li>
				</ol>
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<button class="btn btn-success" onclick={() => { exportResultDialogOpen = false; }}>
			{t('common.ok', { fallback: 'OK' })}
		</button>
	{/snippet}
</BaseAlertDialog>
