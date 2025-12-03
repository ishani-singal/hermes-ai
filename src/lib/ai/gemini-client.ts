/**
 * Gemini AI Client
 * 
 * Shared Gemini client initialization for use across parsers and other AI services.
 * Uses lazy initialization to ensure environment variables are loaded.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

let cachedClient: GoogleGenerativeAI | null = null;

/**
 * Get the Gemini AI client (lazy initialization)
 * 
 * Uses GOOGLE_GENERATIVE_AI_API_KEY from environment variables.
 * Client is cached after first initialization for efficiency.
 * 
 * @returns GoogleGenerativeAI client instance
 * @throws Error if API key is not configured
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY is not configured. Please set it in your environment variables.'
    );
  }

  cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
}

/**
 * Get a specific Gemini model
 * 
 * @param modelName - Model name (default: 'gemini-2.5-flash')
 * @returns GenerativeModel instance
 */
export function getGeminiModel(modelName: string = 'gemini-2.5-flash') {
  const client = getGeminiClient();
  return client.getGenerativeModel({ model: modelName });
}
