import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function resolveSeedAppIdentity() {
  try {
    const packageJsonPath = path.join(APP_ROOT, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const preferredName = packageJson.productName || packageJson.name;
    return typeof preferredName === 'string' ? preferredName.trim() : '';
  } catch (error) {
    console.warn('[seedCli] Failed to resolve app identity from package.json:', error?.message);
    return '';
  }
}

function configureSeedUserDataPath() {
  const appIdentity = resolveSeedAppIdentity();
  if (!appIdentity) {
    return;
  }

  const userDataPath = path.join(app.getPath('appData'), appIdentity);
  fs.mkdirSync(userDataPath, { recursive: true });
  app.setPath('userData', userDataPath);
  app.setName(appIdentity);
}

async function main() {
  configureSeedUserDataPath();
  await app.whenReady();

  const { runSeedFromJsonCli } = await import('../db/seed_from_json.js');
  const exitCode = await runSeedFromJsonCli(process.argv.slice(2));

  app.exit(exitCode);
}

void main();
