/**
 * Embedding service for loading the local model and computing semantic
 * similarity vectors for import workflows.
 *
 * @namespace backend.services.embeddingService
 * @memberof backend.services
 */
import { AutoModel, AutoTokenizer } from '@huggingface/transformers';
import path from 'path';
import fs from 'fs';

// Multilingual model producing 768-dim vectors. It is asymmetric: queries and
// documents must be encoded with different instruction prefixes, otherwise the
// vectors do not align. Queries are CSV field names, documents are ontology
// field names.
// See https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX
const QUERY_PREFIX = 'task: search result | query: ';
const DOCUMENT_PREFIX = 'title: none | text: ';

// q4 is the smallest supported export; this model does not support fp16.
const modelName = 'onnx-community/embeddinggemma-300m-ONNX';
const modelDtype = 'q4';

/**
 * Minimum cosine similarity for a suggestion to be offered.

 */
export const MATCH_THRESHOLD = 0.3;

// Similarity bands for the confidence label attached to a suggestion. `low`
// reuses the matching threshold because anything below it is filtered out
// before a label is assigned.
const CONFIDENCE_HIGH = 0.54;
const CONFIDENCE_MEDIUM = 0.42;

let model = null;
let tokenizer = null;
let isInitializing = false;
let initPromise = null;

function resolveModelPath() {
    const isElectron = !!process.versions.electron;
    const resourcesPath = process.resourcesPath || '';
    const isDevResources = /node_modules[\\/]/i.test(resourcesPath);

    return isElectron && !isDevResources
        ? path.join(process.resourcesPath, 'app', 'src', 'assets', 'models')
        : path.join(process.cwd(), 'src', 'assets', 'models');
}

const modelPath = resolveModelPath();

// Download progress arrives once per file, each starting from 0%.
const loggedProgress = new Set();

/**
 * Log model download progress in 10% steps, without repeating entries.
 * @param {Object} progress - Progress event from transformers.js.
 */
function logDownloadProgress(progress) {
    if (progress.status !== 'progress') return;

    const percent = Math.round(progress.progress || 0);
    if (percent % 10 !== 0) return;

    const key = `${progress.file}:${percent}`;
    if (loggedProgress.has(key)) return;

    loggedProgress.add(key);
    console.log(`Model download: ${progress.file} ${percent}%`);
}

/**
 * Load the embedding model into memory if it is not already initialized.
 * @function initialize
 * @memberof backend.services.embeddingService
 * @returns {Promise<void>}
 */
async function initialize() {
    if (model && tokenizer) {
        return;
    }

    if (initPromise) {
        await initPromise;
        return;
    }

    initPromise = (async () => {
        try {
            isInitializing = true;
            console.log(`Initializing embedding model: ${modelName}`);

            await fs.promises.mkdir(modelPath, { recursive: true });

            const options = { cache_dir: modelPath, progress_callback: logDownloadProgress };

            tokenizer = await AutoTokenizer.from_pretrained(modelName, options);
            model = await AutoModel.from_pretrained(modelName, { ...options, dtype: modelDtype });

            console.log('Model initialized successfully');
        } catch (error) {
            console.error('Failed to initialize embedding model:', error);
            throw error;
        } finally {
            isInitializing = false;
        }
    })();

    try {
        await initPromise;
    } finally {
        initPromise = null;
    }
}

/**
 * Compute a normalized embedding for a single text input.

 *
 * @function computeEmbedding
 * @memberof backend.services.embeddingService
 * @param {string} text - Input text.
 * @param {string} prefix - Instruction prefix matching the input side.
 * @returns {Promise.<(string|null)>}
 */
async function computeEmbedding(text, prefix) {
    if (!model || !tokenizer) {
        await initialize();
    }

    try {
        const cleanText = text.trim().replace(/\s+/g, ' ');
        if (!cleanText) {
            return null;
        }

        const inputs = await tokenizer(`${prefix}${cleanText}`, { padding: true, truncation: true });
        const output = await model(inputs);

        if (!output.sentence_embedding) {
            throw new Error('Model output is missing sentence_embedding');
        }

        return JSON.stringify(Array.from(output.sentence_embedding.data));
    } catch (error) {
        console.error('Error computing embedding:', error);
        return null;
    }
}

/**
 * Compute an embedding for a CSV field name, which acts as a search query.
 * @function computeQueryEmbedding
 * @memberof backend.services.embeddingService
 * @param {string} fieldName - CSV field name.
 * @returns {Promise.<(string|null)>}
 */
async function computeQueryEmbedding(fieldName) {
    return computeEmbedding(fieldName, QUERY_PREFIX);
}

/**
 * Compute an embedding for an ontology field, which acts as a search document.
 * @function computeDocumentEmbedding
 * @memberof backend.services.embeddingService
 * @param {string} name - Ontology field name.
 * @returns {Promise.<(string|null)>}
 */
async function computeDocumentEmbedding(name) {
    return computeEmbedding(name, DOCUMENT_PREFIX);
}

/**
 * Find ontology fields with semantic similarity above the threshold.
 * @function findSimilarFields
 * @memberof backend.services.embeddingService
 * @param {string} csvFieldName - CSV field name.
 * @param {Array.<{id: (string|number), embeddings: (string|null|undefined)}>} ontologyFields - Ontology field rows.
 * @param {number} [threshold=MATCH_THRESHOLD] - Minimum similarity threshold.
 * @returns {Promise.<Array.<{field: Object, similarity: number, confidence: string}>>}
 */
async function findSimilarFields(csvFieldName, ontologyFields, threshold = MATCH_THRESHOLD) {
    if (!csvFieldName || !ontologyFields || ontologyFields.length === 0) {
        return [];
    }

    const queryEmbedding = await computeQueryEmbedding(csvFieldName);
    if (!queryEmbedding) {
        return [];
    }

    const queryVector = JSON.parse(queryEmbedding);
    const similarities = [];

    for (const field of ontologyFields) {
        if (!field.embeddings) continue;

        try {
            const fieldVector = JSON.parse(field.embeddings);
            const similarity = cosineSimilarity(queryVector, fieldVector);

            if (similarity >= threshold) {
                similarities.push({
                    field,
                    similarity,
                    confidence: getConfidenceLevel(similarity),
                });
            }
        } catch (error) {
            console.warn(`Error computing similarity for field ${field.id}:`, error);
        }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Compute cosine similarity between two vectors.
 * @function cosineSimilarity
 * @memberof backend.services.embeddingService
 * @param {number[]} a - First vector.
 * @param {number[]} b - Second vector.
 * @returns {number}
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convert a similarity score into a human-readable confidence label.
 * Bands follow the measured score distribution for EmbeddingGemma, where a
 * correct match sits at 0.42 (median) and 0.54 (upper quartile).
 * @function getConfidenceLevel
 * @memberof backend.services.embeddingService
 * @param {number} similarity - Similarity score.
 * @returns {string}
 */
function getConfidenceLevel(similarity) {
    if (similarity >= CONFIDENCE_HIGH) return 'high';
    if (similarity >= CONFIDENCE_MEDIUM) return 'medium';
    if (similarity >= MATCH_THRESHOLD) return 'low';
    return 'very_low';
}

/**
 * Get the current embedding model status.
 * @function getStatus
 * @memberof backend.services.embeddingService
 * @returns {{isLoaded: boolean, isInitializing: boolean, modelName: string, dtype: string}}
 */
function getStatus() {
    return {
        isLoaded: model !== null && tokenizer !== null,
        isInitializing,
        modelName,
        dtype: modelDtype
    };
}

export const embeddingService = {
    initialize,
    computeQueryEmbedding,
    computeDocumentEmbedding,
    findSimilarFields,
    cosineSimilarity,
    getConfidenceLevel,
    getStatus
};