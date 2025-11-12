import { PostgresStore } from '@mastra/pg';

// Single shared storage instance (lazy initialized to avoid errors during build)
let storageInstance: PostgresStore | null = null;

export function getStorage(): PostgresStore | null {
  // Only initialize if we have a database connection string
  if (!storageInstance && process.env.SUPABASE_TRANSACTION_POOLER_DATABASE_URL) {
    storageInstance = new PostgresStore({
      connectionString: process.env.SUPABASE_TRANSACTION_POOLER_DATABASE_URL,
    });
  }
  return storageInstance;
}
