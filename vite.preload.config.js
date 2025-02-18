import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    build: {
        outDir: '.vite',
        emptyOutDir: false,
        lib: {
            entry: 'preload.js',
            formats: ['cjs'],
            fileName: () => '[name].js',
        },
        rollupOptions: {
            external: ['electron'],
            input: {
                preload: 'src/preload/preload.js',
            },
            output: {
                format: 'commonjs',
                // It should not be split chunks.
                inlineDynamicImports: true,
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
            },
        }
    }
});
