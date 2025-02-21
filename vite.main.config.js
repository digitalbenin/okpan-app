import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    optimizeDeps: {
        exclude: ['@libsql/client', '@libsql/win32-x64-msvc']
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
                '@libsql/win32-x64-msvc',
                /^graphql\/.*/  // Ensure all graphql subpaths are treated as external
            ],
            input: {
                main: 'src/backend/main.js',
                init: 'src/db/init.js',
                schema: 'src/db/schema.js'
            },
            output: {
                format: 'es',
                paths: {
                    'graphql/execution/values': 'graphql/execution/values.js'
                }
            }
        },
    },
    resolve: {
        // Ensure .js files are treated as ESM in main process
        extensions: ['.mjs', '.js', '.json', '.node'],
        mainFields: ['module', 'main']
    },
    esbuild: {
        loader: 'js',
        format: 'esm'
    }
});
