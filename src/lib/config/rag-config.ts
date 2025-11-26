/**
 * RAG Configuration
 * 
 * Centralized configuration for RAG indexing behavior
 */

/**
 * Delay in milliseconds before indexing uploaded files
 * Default: 10 minutes (600000ms)
 * 
 * This delay allows time for:
 * - Agent to link files to equipment or work orders
 * - Users to update metadata before indexing
 * - Reducing duplicate indexing from premature queuing
 */
export const RAG_INDEX_DELAY_MS = parseInt(
  process.env.RAG_INDEX_DELAY_MS || '600000',
  10
);
