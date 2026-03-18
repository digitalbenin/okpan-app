import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import { globalSettings } from './schema.js';
import { eq } from 'drizzle-orm';
import { dirname } from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const USERNAME_ADJECTIVES = [
    'Amber',
    'Bright',
    'Calm',
    'Clever',
    'Golden',
    'Merry',
    'Quiet',
    'Silver',
    'Swift',
    'Wild'
];

const USERNAME_NOUNS = [
    'Badger',
    'Falcon',
    'Fox',
    'Heron',
    'Otter',
    'Panda',
    'Robin',
    'Seal',
    'Wolf',
    'Wren'
];

function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
}

export function generateRandomUsername() {
    const suffix = Math.floor(100 + Math.random() * 900);
    return `${pickRandom(USERNAME_ADJECTIVES)}${pickRandom(USERNAME_NOUNS)}${suffix}`;
}

// Get the database path from env
const dbPath = process.env.DB_FILE_NAME || 'src/db/local.db';

// Ensure the database directory exists
const dbDir = dirname(dbPath);
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

import { setGlobalClientIdNumber } from '../backend/services/projectCache.js';

// Initialize global settings (singleton)
const initializeGlobalSettings = async () => {
    try {
        // Check if global settings already exist
        const existing = await db.select().from(globalSettings).where(eq(globalSettings.id, 1)).limit(1);

        if (existing.length === 0) {
            // Create the singleton row with UUID
            const newClientId = randomUUID();
            await db.insert(globalSettings).values({
                id: 1, // Enforce singleton
                client_id: newClientId,
                app_version: process.env.npm_package_version || '1.0.0'
            });
            console.log('Global settings initialized with new client_id');
            setGlobalClientIdNumber(newClientId);
        } else {
            console.log('Global settings already exist, client_id:', existing[0].client_id);
            setGlobalClientIdNumber(existing[0].client_id);
        }
    } catch (error) {
        console.error('Error initializing global settings:', error);
    }
};

async function getGlobalSettingsRow() {
    const settings = await db.select().from(globalSettings).where(eq(globalSettings.id, 1)).limit(1);

    if (settings.length > 0) {
        return settings[0];
    }

    await initializeGlobalSettings();

    const initializedSettings = await db.select().from(globalSettings).where(eq(globalSettings.id, 1)).limit(1);
    return initializedSettings[0] || null;
}

// Helper function to get client ID
export const getClientId = async () => {
    try {
        const settings = await getGlobalSettingsRow();
        return settings?.client_id || null;
    } catch (error) {
        console.error('Error getting client_id:', error);
        return null;
    }
};

export const getGlobalProfile = async () => {
    try {
        const settings = await getGlobalSettingsRow();
        return {
            clientId: settings?.client_id || null,
            username: settings?.username || null
        };
    } catch (error) {
        console.error('Error getting global profile:', error);
        return {
            clientId: null,
            username: null
        };
    }
};

export const updateGlobalUsername = async (username) => {
    try {
        const normalizedUsername = typeof username === 'string' ? username.trim() : '';
        const nextUsername = normalizedUsername || generateRandomUsername();

        await initializeGlobalSettings();
        await db.update(globalSettings)
            .set({ username: nextUsername })
            .where(eq(globalSettings.id, 1));

        return getGlobalProfile();
    } catch (error) {
        console.error('Error updating global username:', error);
        throw error;
    }
};

// Initialize on startup
initializeGlobalSettings();

export { db, client, dbPath };