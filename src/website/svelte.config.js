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
        // Generate entries: root page + all object pages
        entriesList = [
            '/',
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
            // SPA fallback for preview mode, no fallback for static export
            fallback: isStaticExport ? undefined : '200.html',
            precompress: false,
            strict: isStaticExport
        }),
        prerender: {
            // Only enable prerendering for static export mode
            entries: isStaticExport ? entriesList : [],
            handleHttpError: isStaticExport ? 'warn' : 'ignore'
        },
        alias: {
            '~bootstrap': 'node_modules/bootstrap',
            '~bootstrap-icons': 'node_modules/bootstrap-icons'
        }
    }
};

export default config;
