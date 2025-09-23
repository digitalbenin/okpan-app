import { initClientDb } from '$lib/utils/dbUtils.js';

await initClientDb();

/** @type {import('@sveltejs/kit').HandleClientError} */
export function handleError({ error, event }) {
	console.error('Client error:', error, 'at', event.url);
}