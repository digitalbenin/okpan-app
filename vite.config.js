import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '',
    plugins: [sveltekit()],
    build: {
        rollupOptions: {
            output: {
                entryFileNames: '_app/immutable/entry/[name].[hash].js',
                chunkFileNames: '_app/immutable/chunks/[name].[hash].js',
                assetFileNames: '_app/immutable/assets/[name].[hash][extname]'
            }
        }
    },
    server: {
        port: 5173,
        strictPort: true,
        fs: {
            allow: ['./src'],
        }
    }
});