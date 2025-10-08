import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		'process.env.DB_FILE_NAME': JSON.stringify('../db/local.db')
	},
	server: {
		port: 5174,
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['..']
		}
	}
});
