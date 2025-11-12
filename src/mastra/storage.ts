import { PostgresStore } from '@mastra/pg';

// Single shared storage instance to avoid duplicate database connections
export const storage = new PostgresStore({
  connectionString: process.env.SUPABASE_TRANSACTION_POOLER_DATABASE_URL || '',
});
