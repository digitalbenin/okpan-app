import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { printSchema } from 'graphql';
import { createGraphQLSchema } from '../../src/db/graphqlDefs.js';
import * as schema from '../../src/db/schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateSchema() {
    // Create database connection
    const client = createClient({
        url: process.env.DATABASE_URL || 'file:./local.db',
    });

    const db = drizzle(client, { schema });

    // Generate GraphQL schema using our custom schema generator
    const { schema: graphqlSchema } = createGraphQLSchema(db);

    // Convert schema to SDL (Schema Definition Language)
    const sdl = printSchema(graphqlSchema);

    // Add custom documentation with explicit schema definition
    const documentedSdl = `"""
schema {
  query: Query
  mutation: Mutation
}

# Database Connection Tool API Documentation
This documentation describes the GraphQL API for the Database Connection Tool.

## Queries
The API provides queries to fetch data from various tables including projects, institutions, research fields, and more.

## Mutations
The API supports mutations for inserting data into all tables. Each mutation accepts a list of input objects with the required fields.
"""

${sdl}`;

    // Write the schema to a file
    const outputPath = path.join(__dirname, '..', 'schema.graphql');
    fs.writeFileSync(outputPath, documentedSdl);

    console.log('GraphQL schema has been generated successfully!');
    console.log(`Schema file location: ${outputPath}`);

    // Close the database connection
    await client.close();
}

generateSchema().catch(console.error); 