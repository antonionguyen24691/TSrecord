import 'dotenv/config';
import { getDb } from './database.js';
import { createAdminUser } from './auth.js';

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'admin123';

getDb();
createAdminUser(username, password);
console.log(`[Seed] Admin user created: ${username}`);
console.log('[Seed] Done. You can now start the server with: npm run dev');
