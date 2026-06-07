import 'dotenv/config';
import { getPool } from './platform/database.js';
import { ensurePlatformSchema } from './platform/schema.js';

await ensurePlatformSchema();
console.log('[Platform] PostgreSQL schema is ready.');
await getPool().end();
