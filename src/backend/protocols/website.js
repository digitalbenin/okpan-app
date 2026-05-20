/**
 * Website protocol registration for serving the packaged/static website build.
 *
 * @namespace backend.protocols.website
 * @memberof backend.protocols
 */
import { protocol, app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Registers the `website://` file protocol.
 * @memberof backend.protocols.website
 * @returns {void}
 */
export function registerWebsiteProtocol() {
  protocol.registerFileProtocol('website', (request, callback) => {
    try {
      const url = new URL(request.url);
      const pathname = decodeURIComponent(url.pathname).replace(/^\//, '');
      const websiteRootDir = app.isPackaged ? app.getAppPath() : process.cwd();
      const buildDir = path.join(websiteRootDir, 'src', 'website', 'build');
      const spaShellPath = fs.existsSync(path.join(buildDir, 'index.html'))
        ? path.join(buildDir, 'index.html')
        : path.join(buildDir, '200.html');

      const filePath = !pathname || pathname === 'index.html' || pathname === '200.html'
        ? spaShellPath
        : path.join(buildDir, pathname);

      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
        return;
      }

      if (fs.existsSync(spaShellPath)) {
        callback({ path: spaShellPath });
        return;
      }

      callback({ error: -6 });
    } catch (error) {
      console.error('Website protocol error:', error);
      callback({ error: -2 });
    }
  });
}