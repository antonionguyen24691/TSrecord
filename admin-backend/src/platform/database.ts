import { attachDatabasePool } from '@vercel/functions';
import pg, { type PoolClient, type QueryResultRow } from 'pg';

const { Pool } = pg;

const globalState = globalThis as typeof globalThis & {
  tsrecordPool?: pg.Pool;
};

const createPool = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the Vercel backend.');
  }

  const pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    ssl: process.env.DATABASE_SSL === 'disable'
      ? false
      : { rejectUnauthorized: false },
  });

  attachDatabasePool(pool);
  return pool;
};

export const getPool = () => {
  globalState.tsrecordPool ??= createPool();
  return globalState.tsrecordPool;
};

export const query = async <T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<T[]> => {
  const result = await getPool().query<T>(text, values);
  return result.rows;
};

export const one = async <T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<T | null> => {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
};

export const withTransaction = async <T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
