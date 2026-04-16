<script>
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { resolveStaticHref } from '$lib/utils/sitePaths.js';
	const { t } = getWebsiteTranslationStore();

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
	const { institution, title, projectId, backHref = null } = $props();
	const fallbackHref = isStaticExport ? resolveStaticHref('') : (projectId ? `/?project_id=${projectId}` : '/');
	const resolvedBackHref = backHref || fallbackHref;
</script>

<div class="object-header">
	<a
		href={resolvedBackHref}
		class="d-block text-decoration-none text-secondary text-opacity-75 mb-2"
	>
		<i class="bi bi-chevron-left"></i>
		{t('common.back')}</a
	>
	<p class="mb-0">{institution?.name}</p>
	<h1 class="mt-0">{title}</h1>
</div>
