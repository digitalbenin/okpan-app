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

class EmbeddingService {
    constructor() {
        this.model = null;
        this.isInitializing = false;
        this.modelName = 'Snowflake/snowflake-arctic-embed-m-v2.0';
        const isElectron = !!process.versions.electron;
        const resourcesPath = process.resourcesPath || '';
        const isDevResources = /node_modules[\\/]/i.test(resourcesPath);
        this.modelPath = isElectron && !isDevResources
            ? path.join(process.resourcesPath, 'app', 'src', 'assets', 'models')
            : path.join(process.cwd(), 'src', 'assets', 'models');
    }

    /**
     * Load the embedding model into memory if it is not already initialized.
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.model || this.isInitializing) {
            return;
        }

        try {
            this.isInitializing = true;
            console.log(`Initializing embedding model: ${this.modelName}`);

            await fs.promises.mkdir(this.modelPath, { recursive: true });

            this.model = await pipeline('feature-extraction', this.modelName, {
                cache_dir: this.modelPath,
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
            this.isInitializing = false;
        }
    }

    /**
     * Compute a normalized embedding for a single text input.
     * @param {string} text - Input text.
     * @param {string} [prefix=''] - Optional prefix used by the model.
     * @returns {Promise<string|null>}
     */
    async computeEmbedding(text, prefix = '') {
        if (!this.model) {
            await this.initialize();
        }

        try {
            // Clean and prepare text
            const cleanText = text.trim().replace(/\s+/g, ' ');
            if (!cleanText) {
                return null;
            }

            // Arctic v2 specific format
            const processedText = `${prefix}${cleanText}`;

            // Generate embedding using Arctic v2 recommended settings
            const output = await this.model(processedText, {
                pooling: 'cls',  // Use CLS token as per Arctic v2 docs
                normalize: true  // Normalize embeddings
            });

            // Convert to regular array and return as JSON string
            const embedding = Array.from(output.data);
            return JSON.stringify(embedding);
        } catch (error) {
            console.error('Error computing embedding:', error);
            return null;
        }
    }

    /**
     * Compute an embedding for an ontology field description.
     * @param {string} name - Field name.
     * @param {string} description - Field description.
     * @returns {Promise<string|null>}
     */
    async computeOntologyFieldEmbedding(name, description) {
        // For ontology fields (documents), no prefix needed
        const combinedText = `${name || ''} ${description || ''}`.trim();

        if (!combinedText) {
            return null;
        }

        return await this.computeEmbedding(combinedText);
    }

    /**
     * Compute an embedding for a CSV field name query.
     * @param {string} fieldName - CSV field name.
     * @returns {Promise<string|null>}
     */
    async computeFieldNameEmbedding(fieldName) {
        // For CSV field names (queries), use "query: " prefix as per Arctic v2 docs
        return await this.computeEmbedding(fieldName, 'query: ');
    }

    // For similarity comparison during CSV/JSON imports
    /**
     * Find ontology fields with semantic similarity above the threshold.
     * @param {string} csvFieldName - CSV field name.
     * @param {Array} ontologyFields - Ontology field rows.
     * @param {number} [threshold=0.1] - Minimum similarity threshold.
     * @returns {Promise<Array>}
     */
    async findSimilarFields(csvFieldName, ontologyFields, threshold = 0.1) {
        // Slightly higher threshold for Arctic v2 due to better quality
        if (!csvFieldName || !ontologyFields || ontologyFields.length === 0) {
            return [];
        }

        const queryEmbedding = await this.computeFieldNameEmbedding(csvFieldName);
        if (!queryEmbedding) {
            return [];
        }

        const queryVector = JSON.parse(queryEmbedding);
        const similarities = [];

        for (const field of ontologyFields) {
            if (!field.embeddings) continue;

            try {
                const fieldVector = JSON.parse(field.embeddings);
                const similarity = this.cosineSimilarity(queryVector, fieldVector);

                if (similarity >= threshold) {
                    similarities.push({
                        field,
                        similarity,
                        confidence: this.getConfidenceLevel(similarity),
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
     * @param {number[]} a - First vector.
     * @param {number[]} b - Second vector.
     * @returns {number}
     */
    cosineSimilarity(a, b) {
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
     * @param {number} similarity - Similarity score.
     * @returns {string}
     */
    getConfidenceLevel(similarity) {
        if (similarity >= 0.35) return 'high';
        if (similarity >= 0.25) return 'medium';
        if (similarity >= 0.20) return 'low';
        return 'very_low';
    }

    /**
     * Get the current embedding model status.
     * @returns {{isLoaded:boolean, isInitializing:boolean, modelName:string}}
     */
    getStatus() {
        return {
            isLoaded: this.model !== null,
            isInitializing: this.isInitializing,
            modelName: this.modelName
        };
    }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();