// In static export mode this page is hydrated as SPA and loads site data client-side.
const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

export async function load() {
    if (isStaticExport) {
        return {
            connection_types: [],
            needsClientLoad: true
        };
    }
}
