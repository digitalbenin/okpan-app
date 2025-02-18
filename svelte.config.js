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
        paths: {
            relative: false,
        },
        alias: {
            '~bootstrap': 'node_modules/bootstrap',
            '~bootstrap-icons': 'node_modules/bootstrap-icons'
        }
    }
};