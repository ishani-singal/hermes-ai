import { createGoogleGenerativeAI  } from '@ai-sdk/google';

const vertexAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_CLOUD_VERTEX_AI_API_KEY || '',});

export const embedder = vertexAI.textEmbedding("text-embedding-004");