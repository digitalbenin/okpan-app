/**
 * IPC handlers for embedding maintenance tasks.
 * @namespace backend.handlers.embeddingHandler
 * @memberof backend.handlers
 */
import { db } from '../../db/init.js';
import { ontology_fields, texts } from '../../db/schema.js';
import { eq, isNull } from 'drizzle-orm';
import { embeddingService } from '../services/embeddingService.js';

/**
 * Compute and store embeddings for all ontology fields that don't have one yet.
 * Returns the number of fields processed.
 * @memberof backend.handlers.embeddingHandler
 * @returns {Promise<number>}
 */
export async function handleComputeAllMissingEmbeddings() {
  try {
    const fieldsWithoutEmbeddings = await db
      .select({
        field_id: ontology_fields.id,
        name_content: texts.content,
        description_content: texts.content
      })
      .from(ontology_fields)
      .leftJoin(texts, eq(ontology_fields.name_id, texts.id))
      .where(isNull(ontology_fields.embeddings))
      .execute();

    await embeddingService.initialize();

    for (const field of fieldsWithoutEmbeddings) {
      const embedding = await embeddingService.computeOntologyFieldEmbedding(
        field.name_content,
        field.description_content
      );

      if (embedding) {
        await db
          .update(ontology_fields)
          .set({ embeddings: embedding })
          .where(eq(ontology_fields.id, field.field_id))
          .execute();
      }
    }

    return fieldsWithoutEmbeddings.length;
  } catch (error) {
    console.error('Error computing embeddings:', error);
    throw error;
  }
}
