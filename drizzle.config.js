import path from 'path';
import 'dotenv/config';

/** @type { import("drizzle-kit").Config } */
export default {
    schema: './src/db/schema.js',
    out: './src/db/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: `file:${path.resolve(process.env.DB_FILE_NAME || 'src/db/local.db').replace(/\\/g, '/')}`
    }
};