import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
    kit: {
        adapter: adapter({
            fallback: 'index.html'
        }),
        csp: {
            directives: {
                'script-src': ['self']
            },
        },
        // Use relative asset paths for file:// loading in packaged app
        paths: {
            relative: true,
        },
        alias: {
            '~bootstrap': 'node_modules/bootstrap',
            '~bootstrap-icons': 'node_modules/bootstrap-icons'
        }
    }
};