/**
 * Backend runtime mode.
 * - PostgreSQL (Vercel / serverless): DATABASE_URL is set.
 * - SQLite (local / Fly.io): legacy v1 admin + client routes.
 */
export const usePostgresBackend = (): boolean =>
  Boolean(process.env.DATABASE_URL?.trim());

export const isVercelDeployment = (): boolean =>
  Boolean(process.env.VERCEL);

export const isLegacySqliteBackend = (): boolean =>
  !usePostgresBackend();
