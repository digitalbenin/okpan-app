import { initClientDb } from '$lib/utils/dbUtils.js';

// Initialize the client-side database when the app starts.
// The top-level await here ensures this module doesn't resolve
// until the database is ready.
await initClientDb();

/** @type {import('@sveltejs/kit').HandleClientError} */
export function handleError({ error, event }) {
	console.error('Client error:', error, 'at', event.url);
}