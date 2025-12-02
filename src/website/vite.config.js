import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
	const isStaticExport = process.env.STATIC_EXPORT === 'true';
	
	return {
		plugins: [sveltekit()],
		define: {
			'process.env.DB_FILE_NAME': JSON.stringify('../db/local.db'),
			'import.meta.env.VITE_USE_JSON': isStaticExport ? JSON.stringify('true') : JSON.stringify('false')
		},
		server: {
			port: 5174,
			fs: {
				// Allow serving files from one level up to the project root
				allow: ['..']
			}
		}
	};
});
