import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    optimizeDeps: {
        exclude: ['graphql', '@libsql/client', '@libsql/win32-x64-msvc']
    },
    build: {
        outDir: '.vite',
        emptyOutDir: false,
        lib: {
            entry: 'main.js',
            formats: ['es'],
            fileName: () => '[name].js',
        },
        rollupOptions: {
            external: [
                'electron',
                'graphql',
                '@libsql/client',
                '@libsql/win32-x64-msvc'
            ],
            input: {
                main: 'src/backend/main.js',
                init: 'src/db/init.js',
                schema: 'src/db/schema.js'
            }
        },

    },
    resolve: {
        // Ensure .js files are treated as CommonJS in main process
        extensions: ['.mjs', '.js', '.json', '.node'],
    }
});
