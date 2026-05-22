/**
 * Embedding service for loading the local model and computing semantic
 * similarity vectors for import workflows.
 *
 * @namespace backend.services.embeddingService
 * @memberof backend.services
 */
import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';

const modelName = 'Snowflake/snowflake-arctic-embed-m-v2.0';
let model = null;
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

/**
 * Load the embedding model into memory if it is not already initialized.
 * @function initialize
 * @memberof backend.services.embeddingService
 * @returns {Promise<void>}
 */
async function initialize() {
    if (model) {
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

            model = await pipeline('feature-extraction', modelName, {
                cache_dir: modelPath,
                dtype: 'q8',
                progress_callback: (progress) => {
                    if (progress.status === 'downloading') {
                        console.log(`Model download: ${Math.round(progress.percent || 0)}%`);
                    }
                }
            });

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
 * @function computeEmbedding
 * @memberof backend.services.embeddingService
 * @param {string} text - Input text.
 * @param {string} [prefix=''] - Optional prefix used by the model.
 * @returns {Promise.<(string|null)>}
 */
async function computeEmbedding(text, prefix = '') {
    if (!model) {
        await initialize();
    }

    try {
        const cleanText = text.trim().replace(/\s+/g, ' ');
        if (!cleanText) {
            return null;
        }

        const processedText = `${prefix}${cleanText}`;

        const output = await model(processedText, {
            pooling: 'cls',
            normalize: true
        });

        const embedding = Array.from(output.data);
        return JSON.stringify(embedding);
    } catch (error) {
        console.error('Error computing embedding:', error);
        return null;
    }
}

/**
 * Compute an embedding for an ontology field description.
 * @function computeOntologyFieldEmbedding
 * @memberof backend.services.embeddingService
 * @param {string} name - Field name.
 * @param {string} description - Field description.
 * @returns {Promise.<(string|null)>}
 */
async function computeOntologyFieldEmbedding(name, description) {
    const combinedText = `${name || ''} ${description || ''}`.trim();

    if (!combinedText) {
        return null;
    }

    return computeEmbedding(combinedText);
}

/**
 * Compute an embedding for a CSV field name query.
 * @function computeFieldNameEmbedding
 * @memberof backend.services.embeddingService
 * @param {string} fieldName - CSV field name.
 * @returns {Promise.<(string|null)>}
 */
async function computeFieldNameEmbedding(fieldName) {
    return computeEmbedding(fieldName, 'query: ');
}

/**
 * Find ontology fields with semantic similarity above the threshold.
 * @function findSimilarFields
 * @memberof backend.services.embeddingService
 * @param {string} csvFieldName - CSV field name.
 * @param {Array.<{id: (string|number), embeddings: (string|null|undefined)}>} ontologyFields - Ontology field rows.
 * @param {number} [threshold=0.1] - Minimum similarity threshold.
 * @returns {Promise.<Array.<{field: Object, similarity: number, confidence: string}>>}
 */
async function findSimilarFields(csvFieldName, ontologyFields, threshold = 0.1) {
    if (!csvFieldName || !ontologyFields || ontologyFields.length === 0) {
        return [];
    }

    const queryEmbedding = await computeFieldNameEmbedding(csvFieldName);
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
 * @function getConfidenceLevel
 * @memberof backend.services.embeddingService
 * @param {number} similarity - Similarity score.
 * @returns {string}
 */
function getConfidenceLevel(similarity) {
    if (similarity >= 0.35) return 'high';
    if (similarity >= 0.25) return 'medium';
    if (similarity >= 0.20) return 'low';
    return 'very_low';
}

/**
 * Get the current embedding model status.
 * @function getStatus
 * @memberof backend.services.embeddingService
 * @returns {{isLoaded: boolean, isInitializing: boolean, modelName: string}}
 */
function getStatus() {
    return {
        isLoaded: model !== null,
        isInitializing,
        modelName
    };
}

export const embeddingService = {
    initialize,
    computeEmbedding,
    computeOntologyFieldEmbedding,
    computeFieldNameEmbedding,
    findSimilarFields,
    cosineSimilarity,
    getConfidenceLevel,
    getStatus
};