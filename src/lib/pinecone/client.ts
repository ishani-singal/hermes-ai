/**
 * Pinecone Client Configuration
 * 
 * Initializes connection to Pinecone vector database for RAG functionality.
 * Uses Pinecone Inference API for embeddings (text-embedding-3-small).
 */

import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not defined');
}

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('PINECONE_INDEX_NAME is not defined');
}

if (!process.env.PINECONE_INDEX_HOST) {
  throw new Error('PINECONE_INDEX_HOST is not defined');
}

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Get the index instance
const indexName = process.env.PINECONE_INDEX_NAME;
const indexHost = process.env.PINECONE_INDEX_HOST;
const index = pinecone.index(indexName, indexHost);
const namespaceName = process.env.PINECONE_NAMESPACE || '__default__';
const namespace = index.namespace(namespaceName);

export { pinecone, namespace };
