import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../../db/init.js';
import { ontology_fields, texts } from '../../db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load default ontology fields from JSON file
let defaultOntologyData = null;

const loadDefaultOntologyFields = () => {
    if (!defaultOntologyData) {
        try {
            const jsonPath = join(__dirname, '../../db/default_ontology_fields.json');
            const jsonContent = readFileSync(jsonPath, 'utf8');
            defaultOntologyData = JSON.parse(jsonContent);
        } catch (error) {
            console.error('Error loading default ontology fields JSON:', error);
            throw new Error('Failed to load default ontology fields configuration');
        }
    }
    return defaultOntologyData;
};

export const seedDefaultOntologyFields = async (projectId, defaultLanguageId) => {
    try {
        console.log(`Seeding default ontology fields for project ${projectId}`);

        const ontologyData = loadDefaultOntologyFields();
        const { categories, fields } = ontologyData;

        // 1. First create category text entries
        const categoryTextIds = {};
        for (const [key, value] of Object.entries(categories)) {
            const [categoryText] = await db.insert(texts).values({
                id: uuidv4(),
                content: value,
                context: `ontology.category.${key}`,
                original_language_id: defaultLanguageId
            }).returning();
            categoryTextIds[key] = categoryText.id;
        }

        // 2. Create ontology fields
        const createdFields = [];
        for (const field of fields) {
            // Create name text
            const [nameText] = await db.insert(texts).values({
                id: uuidv4(),
                content: field.name,
                context: 'ontology_fields.name',
                original_language_id: defaultLanguageId
            }).returning();

            // Create description text  
            const [descriptionText] = await db.insert(texts).values({
                id: uuidv4(),
                content: field.description,
                context: 'ontology_fields.description',
                original_language_id: defaultLanguageId
            }).returning();

            // Create ontology field
            const [ontologyField] = await db.insert(ontology_fields).values({
                id: uuidv4(),
                name_id: nameText.id,
                description_id: descriptionText.id,
                category_id: categoryTextIds[field.category],
                project_id: projectId, // Associate with project
                // onwebsite will use the default value (1) from the schema
                embeddings: null // Will be computed later if needed
            }).returning();

            createdFields.push(ontologyField);
        }

        console.log(`Successfully seeded ${createdFields.length} ontology fields for project ${projectId}`);
        return createdFields;

    } catch (error) {
        console.error(`Error seeding ontology fields for project ${projectId}:`, error);
        throw error;
    }
};

// Export function to get the default fields configuration (useful for testing or admin purposes)
export const getDefaultOntologyFieldsConfig = () => {
    return loadDefaultOntologyFields();
};
