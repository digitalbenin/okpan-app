import { app } from 'electron';

async function main() {
  await app.whenReady();

  const { runSeedFromJsonCli } = await import('../db/seed_from_json.js');
  const exitCode = await runSeedFromJsonCli(process.argv.slice(2));

  app.exit(exitCode);
}

void main();
