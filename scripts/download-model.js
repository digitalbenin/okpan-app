/**
 * Download the embedding model used for import field matching.
 * Run via: node scripts/download-model.js
 * The model is cached under src/assets/models/ so it gets bundled
 * into the production Electron app by forge.config.js (packageAfterCopy).
 */
import { AutoModel, AutoTokenizer } from '@huggingface/transformers';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.resolve(__dirname, '..', 'src', 'assets', 'models');
const modelName = 'onnx-community/embeddinggemma-300m-ONNX';
const modelDtype = 'q4';

async function main() {
  console.log(`Downloading model: ${modelName}`);
  console.log(`Cache directory: ${modelPath}`);

  await fs.promises.mkdir(modelPath, { recursive: true });

  const loggedProgress = new Set();
  const progress_callback = (progress) => {
    if (progress.status !== 'progress') return;

    const percent = Math.round(progress.progress || 0);
    if (percent % 10 !== 0) return;

    const key = `${progress.file}:${percent}`;
    if (loggedProgress.has(key)) return;

    loggedProgress.add(key);
    console.log(`  ${progress.file}: ${percent}%`);
  };

  const options = { cache_dir: modelPath, progress_callback };

  const tokenizer = await AutoTokenizer.from_pretrained(modelName, options);
  const model = await AutoModel.from_pretrained(modelName, { ...options, dtype: modelDtype });

  // Run one inference per side of the comparison to verify the export works
  const inputs = await tokenizer(
    ['task: search result | query: title', 'title: none | text: designation'],
    { padding: true }
  );
  const output = await model(inputs);
  const embedding = output.sentence_embedding;

  console.log(`Model verified. Embedding dimension: ${embedding.dims[1]}`);
  console.log('Model download complete.');
}

main().catch((err) => {
  console.error('Model download failed:', err);
  process.exit(1);
});
