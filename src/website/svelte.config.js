import adapter from '@sveltejs/adapter-static';

// Dual-mode configuration based on environment variable
const isStaticExport = process.env.STATIC_EXPORT === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter({
            // Use different output folders for export vs preview
            pages: isStaticExport ? 'build-export' : 'build',
            assets: isStaticExport ? 'build-export' : 'build',
            // Static export needs fallback for CSR homepage; preview mode uses 200.html
            fallback: isStaticExport ? 'index.html' : '200.html',
            precompress: false,
            strict: false // Don't fail on non-prerendered pages
        }),
        prerender: {
            // In static export mode we build an SPA shell only; data is injected at runtime.
            entries: isStaticExport ? ['/'] : [],
            handleHttpError: 'warn',
            handleMissingId: 'ignore',
            handleEntryGeneratorMismatch: 'ignore',
            // Ignore routes with prerender that weren't found during crawl
            handleUnseenRoutes: 'ignore'
        },
        alias: {
            '~bootstrap': 'node_modules/bootstrap',
            '~bootstrap-icons': 'node_modules/bootstrap-icons'
        }
    }
};

export default config;
