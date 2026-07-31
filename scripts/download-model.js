/**
 * Download the embedding model used for import field matching.
 * Run via: node scripts/download-model.js
 * The model is cached under src/assets/models/ so it gets bundled
 * into the production Electron app by forge.config.js (packageAfterCopy).
 */
import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.resolve(__dirname, '..', 'src', 'assets', 'models');
const modelName = 'Snowflake/snowflake-arctic-embed-m-v2.0';

async function main() {
  console.log(`Downloading model: ${modelName}`);
  console.log(`Cache directory: ${modelPath}`);

  await fs.promises.mkdir(modelPath, { recursive: true });

  const model = await pipeline('feature-extraction', modelName, {
    cache_dir: modelPath,
    dtype: 'q8',
    progress_callback: (progress) => {
      if (progress.status === 'downloading') {
        const pct = Math.round(progress.percent || 0);
        if (pct % 10 === 0 || pct === 100) {
          console.log(`  Download progress: ${pct}%`);
        }
      }
    }
  });

  // Run a tiny inference to verify the model works
  const result = await model('test', { pooling: 'mean', normalize: true });
  console.log(`Model verified. Embedding dimension: ${result.data.length}`);
  console.log('Model download complete.');
}

main().catch((err) => {
  console.error('Model download failed:', err);
  process.exit(1);
});
