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
            'graphql',
            'libsql',
            '@libsql/client',
            '@libsql/win32-x64-msvc',
            'sharp',
            '@huggingface/transformers',
            'onnxruntime-node',
            'node-datachannel',
            'ws',
            'yjs',
            'trystero',
            '@winstonfassett/y-webrtc-trystero',
            'webtorrent',
            '@thaunknown/simple-peer',
            'bittorrent-dht',
            'bittorrent-tracker',
            'utp-native',
            'utp-native/build/Release/utp.node',
            'fs-chunk-store',
            'torrent-discovery',
            'ut_metadata',
            'ut_pex'
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
        commonjsOptions: {
            // Keep dynamic requires untouched inside external deps
            ignoreDynamicRequires: true
        },
        rollupOptions: {
            external: [
                'electron',
                'graphql',
                /^graphql\/.*/,
                'sharp',
                'libsql',
                '@libsql/client',
                '@libsql/win32-x64-msvc',
                '@huggingface/transformers',
                'onnxruntime-node',
                /^onnxruntime.*/,
                'y-protocols/awareness',
                'node-datachannel',
                /^node-datachannel.*/,
                'ws',
                'yjs',
                '@winstonfassett/y-webrtc-trystero',
                'trystero',
                /^trystero.*/,
                'webtorrent',
                '@thaunknown/simple-peer',
                /^webtorrent\/.*/,
                'bittorrent-dht',
                /^bittorrent-.*/,
                'utp-native',
                'utp-native/build/Release/utp.node',
                'fs-chunk-store',
                'torrent-discovery',
                'ut_metadata',
                'ut_pex',
                /^node:.*/
            ],
            input: {
                main: 'src/backend/main.js',
                init: 'src/db/init.js',
                schema: 'src/db/schema.js'
            },
            output: {
                format: 'es',
                // Ensure ESM subpath import resolves with extension
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
