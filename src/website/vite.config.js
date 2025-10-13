import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	base: './',
	build: {
		rollupOptions: {
			output: {
				entryFileNames: '_app/immutable/entry/[name].[hash].js',
				chunkFileNames: '_app/immutable/chunks/[name].[hash].js',
				assetFileNames: '_app/immutable/assets/[name].[hash][extname]'
			}
		}
	},
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
