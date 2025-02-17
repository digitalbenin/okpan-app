import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    root: 'src/backend',
    build: {
        outDir: '../../out/main',
        emptyOutDir: false,
        lib: {
            entry: 'preload.js',
            formats: ['cjs'],
            fileName: () => 'preload.js',
        },
        rollupOptions: {
            external: ['electron']
        }
    }
});
