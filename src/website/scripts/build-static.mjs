import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const websiteDir = path.resolve(__dirname, '..');
const viteBin = path.join(websiteDir, 'node_modules', 'vite', 'bin', 'vite.js');

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [viteBin, 'build'], {
    cwd: websiteDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      STATIC_EXPORT: 'true'
    }
  });

  child.on('error', (error) => {
    reject(new Error(`Failed to start website static build: ${error.message}`));
  });

  child.on('close', (code) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`Website static build failed with exit code ${code}`));
  });
});