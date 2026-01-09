import adapter from '@sveltejs/adapter-static';
import fs from 'fs';
import path from 'path';

// Dual-mode configuration based on environment variable
const isStaticExport = process.env.STATIC_EXPORT === 'true';

// Load entries from data.json in static export mode
let entriesList = ['*'];
if (isStaticExport) {
    try {
        const dataPath = path.join(process.cwd(), 'static', 'data.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        // Generate entries: only object detail pages (homepage is CSR-only)
        // Note: (object) is a layout group, doesn't appear in URL
        entriesList = [
            ...data.objects.map(obj => `/${obj.id}`)
        ];
        console.log(`[Config] Loaded ${data.objects.length} object routes from data.json`);
    } catch (error) {
        console.warn('[Config] Could not load data.json, using default entries:', error.message);
    }
}

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
            // Only enable prerendering for static export mode
            entries: isStaticExport ? entriesList : [],
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
