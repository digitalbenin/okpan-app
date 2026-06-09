import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
    kit: {
        adapter: adapter({
            fallback: 'index.html'
        }),
        csp: {
            mode: 'auto',
            directives: {
                'script-src': ['self', 'unsafe-inline'],
                'style-src': ['self', 'unsafe-inline'],
                'img-src': ['self', 'data:', 'blob:'],
                'font-src': ['self', 'data:'],
                'connect-src': ['self'],
                'base-uri': ['none'],
                'object-src': ['none']
            }
        },
        paths: {
            base: '',
            assets: '',
            relative: true
        },
        alias: {
            '~bootstrap': 'node_modules/bootstrap',
             '$assets': 'src/assets',
            '~bootstrap-icons': 'node_modules/bootstrap-icons'
        }
    }
};