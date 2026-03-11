import { base } from '$app/paths';

export function resolveSitePath(path = '') {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  return cleanPath ? `${base}/${cleanPath}` : (base || '/');
}

export function resolveStaticHref(path = '') {
  return resolveSitePath(path);
}