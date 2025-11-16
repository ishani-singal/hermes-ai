import { PostgresStore } from '@mastra/pg';
import { PineconeVector } from '@mastra/pinecone';

// Single shared storage instance to avoid duplicate database connections
export const postgres = new PostgresStore({
  connectionString: process.env.SUPABASE_TRANSACTION_POOLER_DATABASE_URL || '',
});

export const vector = new PineconeVector({
  apiKey: process.env.PINECONE_API_KEY || '',
  environment: process.env.PINECONE_ENVIRONMENT || '',
});