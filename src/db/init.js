import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import { globalSettings } from './schema.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import electron from 'electron';
const { app } = electron;

// Resolve the database path for dev and packaged production
const defaultRel = 'src/db/local.db';
const envPath = process.env.DB_FILE_NAME || defaultRel;
const isElectron = !!process.versions.electron;
let dbPath;
if (path.isAbsolute(envPath)) {
    dbPath = envPath;
} else if (isElectron && app?.isPackaged) {
    // In packaged Electron, resolve relative to the app path
    const base = app.getAppPath?.() || (process.resourcesPath ? path.join(process.resourcesPath, 'app') : process.cwd());
    dbPath = path.join(base, envPath);
} else {
    // In development or non-Electron, resolve relative to project root (CWD)
    dbPath = path.resolve(envPath);
}

// Ensure the database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Debug logging
console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

// Create the SQLite client with proper URL format
const client = createClient({
    url: `file:${dbPath.replace(/\\/g, '/')}` // Ensure forward slashes for URLs
});

// Create Drizzle instance with schema
const db = drizzle(client, { schema });

// Initialize global settings (singleton)
const initializeGlobalSettings = async () => {
    try {
        // Check if global settings already exist
        const existing = await db.select().from(globalSettings).where(eq(globalSettings.id, 1)).limit(1);

        if (existing.length === 0) {
            // Create the singleton row with UUID
            await db.insert(globalSettings).values({
                id: 1, // Enforce singleton
                client_id: randomUUID(),
                app_version: process.env.npm_package_version || '1.0.0'
            });
            console.log('Global settings initialized with new client_id');
        } else {
            console.log('Global settings already exist, client_id:', existing[0].client_id);
        }
    } catch (error) {
        console.error('Error initializing global settings:', error);
    }
};

// Helper function to get client ID
export const getClientId = async () => {
    try {
        const settings = await db.select().from(globalSettings).where(eq(globalSettings.id, 1)).limit(1);
        return settings[0]?.client_id || null;
    } catch (error) {
        console.error('Error getting client_id:', error);
        return null;
    }
};

// Initialize on startup
initializeGlobalSettings();

export { db };