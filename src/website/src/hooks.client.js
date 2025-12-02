const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

// Only initialize database in preview mode (Electron), not in static export
if (!isStaticExport) {
	const { initClientDb } = await import('$lib/utils/dbUtils.js');
	await initClientDb();
}

/** @type {import('@sveltejs/kit').HandleClientError} */
export function handleError({ error, event }) {
	console.error('Client error:', error, 'at', event.url);
}