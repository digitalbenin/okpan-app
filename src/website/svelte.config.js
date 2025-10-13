import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter({
            // Emit index.html as SPA fallback to match Electron loader
            fallback: 'index.html'
        }),
        paths: {
            relative: true,
        },
        alias: {
            '~bootstrap': 'node_modules/bootstrap',
            '~bootstrap-icons': 'node_modules/bootstrap-icons'
        }
    }
};

export default config;
