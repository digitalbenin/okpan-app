import path from 'path';

function resolveMediaPath(urlObj) {
  let pathStr;

  const isAbsolute = (p) => path.posix.isAbsolute(p);
  const normalize = (p) => path.posix.normalize(p);

  if (urlObj.hostname && /^[a-zA-Z]$/.test(urlObj.hostname)) {
    pathStr = urlObj.hostname + decodeURIComponent(urlObj.pathname);
  } else {
    pathStr = decodeURIComponent(urlObj.pathname).replace(/^\//, '');
  }

  if (/^[a-zA-Z]\//.test(pathStr)) {
    return `/${pathStr}`;
  }

  if (isAbsolute(pathStr)) {
    return normalize(pathStr);
  }

  const projectRoot = 'c:/Users/fenic/projects/db-connection-tool-electron';
  return path.posix.join(projectRoot, 'src', pathStr);
}

const urls = [
  'media:///%2FVolumes/VMware%20Shared%20Folders/test.jpg',
  'media://src/%2FVolumes/VMware%20Shared%20Folders/test.jpg',
  'media://volumes/VMware%20Shared%20Folders/test.jpg'
];

urls.forEach(u => {
  const urlObj = new URL(u);
  const resolved = resolveMediaPath(urlObj);
  console.log(JSON.stringify({
    href: urlObj.href,
    hostname: urlObj.hostname,
    pathname: urlObj.pathname,
    resolvedPath: resolved
  }, null, 2));
});
