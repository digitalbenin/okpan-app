export function addImageProtocolPrefix(url) {
    if (!url) return
    return `media://${url}`;
}