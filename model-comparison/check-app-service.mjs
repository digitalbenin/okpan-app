/**
 * Smoke test for the app's embedding service with EmbeddingGemma.
 *
 * Uses the real service and the real ontology vocabulary, so it exercises the
 * exact code path the app uses (AutoModel + sentence_embedding, asymmetric
 * query/document prefixes) and reports whether the calibrated threshold
 * produces sensible suggestions.
 *
 * Run with: node model-comparison/check-app-service.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { embeddingService, MATCH_THRESHOLD } from '../src/backend/services/embeddingService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ONTOLOGY_PATH = path.join(REPO_ROOT, 'src', 'db', 'default_ontology_fields.json');

// A few headers from the real museum exports, with the expected ontology field.
const CASES = [
    { header: 'Object Number', expected: 'object id' },
    { header: 'Title', expected: 'designation' },
    { header: 'Medium', expected: 'material' },
    { header: 'Dimensions', expected: 'dimensions' },
    { header: 'Culture', expected: 'ethnic attribution' },
    { header: 'Maße', expected: 'dimensions' },
    { header: 'Numéro de tri', expected: 'object id' },
    { header: 'Datierung', expected: 'date made' }
];

console.log('Initializing app embedding service...');
await embeddingService.initialize();
console.log('Status:', embeddingService.getStatus());

const seed = JSON.parse(fs.readFileSync(ONTOLOGY_PATH, 'utf8'));
const fields = [];
for (const field of seed.fields) {
    fields.push({
        id: field.name,
        name: field.name,
        embeddings: await embeddingService.computeDocumentEmbedding(field.name)
    });
}
console.log(`Indexed ${fields.length} ontology fields\n`);

// Exercise the threshold the app actually uses, so this test cannot drift from it.
let correct = 0;

for (const testCase of CASES) {
    const matches = await embeddingService.findSimilarFields(testCase.header, fields, MATCH_THRESHOLD);
    const top = matches[0];
    const hit = top && top.field.name === testCase.expected;
    if (hit) correct += 1;

    console.log(`${hit ? 'OK  ' : 'MISS'} "${testCase.header}" -> expects "${testCase.expected}"`);
    console.log(`      ${matches.length} suggestion(s) above MATCH_THRESHOLD (${MATCH_THRESHOLD})`);
    for (const match of matches.slice(0, 3)) {
        console.log(`        ${match.similarity.toFixed(3)}  ${match.confidence.padEnd(8)} ${match.field.name}`);
    }
}

console.log(`\nTop-1 correct: ${correct}/${CASES.length}`);
const sample = JSON.parse(fields[0].embeddings);
console.log(`Embedding dimension: ${sample.length}`);
