// Ensure this page is prerendered in static export
const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
export const prerender = isStaticExport || undefined;

export async function load() {
    if (isStaticExport) {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const dataPath = path.join(process.cwd(), 'static', 'data.json');
            
            const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
            
            return {
                project: data.project || {},
                settings: data.settings || {}
            };
        } catch (e) {
            console.error('[About] Failed to load data.json during prerender:', e);
            return { project: {}, settings: {} };
        }
    }
}
