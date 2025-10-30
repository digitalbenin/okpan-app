import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    server: {
        hmr: {
            overlay: false, // Disable overlay to prevent memory leaks
        },
        watch: {
            usePolling: false, // Disable polling if enabled
            ignored: ['**/node_modules/**', '**/.git/**'], // Ignore unnecessary files
        },
    },
    optimizeDeps: {
        holdUntilCrawlEnd: false,
        exclude: [
            '@libsql/client',
            '@libsql/win32-x64-msvc',
            'sharp',
            '@xenova/transformers',
            'onnxruntime-node',
            'node-datachannel',
            'ws',
            'yjs',
            'trystero',
            '@winstonfassett/y-webrtc-trystero'
        ]
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
                'sharp',
                '@libsql/client',
                '@libsql/win32-x64-msvc',
                '@xenova/transformers',
                'onnxruntime-node',
                /^onnxruntime.*/,
                /^graphql\/.*/,  // Ensure all graphql subpaths are treated as external
                'y-protocols/awareness', // Avoid bundling deep import used by y-webrtc-trystero
                'node-datachannel',
                /^node-datachannel.*/,
                'ws',
                'yjs',
                '@winstonfassett/y-webrtc-trystero',
                'trystero',
                /^trystero.*/
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
