export function isElectronApiAvailable() {
    return (
        typeof window !== 'undefined' &&
        window?.api &&
        typeof window.api.executeGraphQL === 'function'
    );
}
