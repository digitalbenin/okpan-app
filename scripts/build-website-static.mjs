import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const websiteDir = path.join(rootDir, 'src', 'website');
const buildExportDir = path.join(websiteDir, 'build-export');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

await new Promise((resolve, reject) => {
  const child = spawn(npmCommand, ['run', 'build', '--', '--mode', 'production'], {
    cwd: websiteDir,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      STATIC_EXPORT: 'true',
      NODE_ENV: 'production'
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


