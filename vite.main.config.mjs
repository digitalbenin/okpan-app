import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    root: 'src/backend',
    build: {
        outDir: '../../out/main',
        emptyOutDir: true,
        lib: {
            entry: 'main.js',
            formats: ['cjs'],
            fileName: () => '[name].js',
        },
        rollupOptions: {
            external: [
                'electron',
                'electron-squirrel-startup',
                '@libsql/client',
                '@libsql/win32-x64-msvc'
            ],
            input: {
                main: 'src/backend/main.js',
                init: 'src/db/init.js',
                schema: 'src/db/schema.js'
            }
        }
    },
    resolve: {
        // Ensure .js files are treated as CommonJS in main process
        extensions: ['.js', '.json', '.node']
    }
});
