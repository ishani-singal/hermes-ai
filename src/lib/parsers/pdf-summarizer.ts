/**
 * PDF Summarizer
 * 
 * Generates AI-powered summaries of PDF documents using Gemini.
 * Extracts key information: document type, topics, equipment, safety warnings.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!API_KEY) {
  console.warn('[PDFSummarizer] GOOGLE_GENERATIVE_AI_API_KEY is not configured. PDF summarization will fail.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * Generate a structured summary of a PDF document
 * 
 * @param text - Raw text extracted from PDF
 * @param fileName - Original filename for context
 * @returns Structured summary of the document
 */
export async function summarizeDocument(text: string, fileName?: string): Promise<string> {
  if (!genAI || !API_KEY) {
    throw new Error(
      'PDF summarization is not available. Please configure the GOOGLE_API_KEY environment variable.'
    );
  }

  console.log(`[PDFSummarizer] Generating summary (${text.length} characters)`);

  // Truncate very long documents to avoid token limits
  // Keep first 15000 characters (~3000 tokens) which covers most technical docs
  const truncatedText = text.length > 15000 ? text.substring(0, 15000) + '\n\n[Document truncated for analysis]' : text;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analyze this technical document and provide a structured summary.

${fileName ? `FILENAME: ${fileName}\n` : ''}
DOCUMENT TEXT:
${truncatedText}

Provide a concise summary with:

1. **Document Type**: (manual, safety guide, SOP, troubleshooting guide, specification sheet, etc.)

2. **Main Topics**: 3-5 key topics covered (bullet points)

3. **Equipment/Systems**: Any specific equipment, models, or systems mentioned

4. **Key Safety Warnings**: Any critical safety information (if applicable)

5. **Useful For**: What questions or tasks this document helps with

Keep the summary concise (200-300 words total). Be specific and technical.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const summary = response.text();

    if (!summary || summary.trim().length === 0) {
      throw new Error('No summary generated');
    }

    console.log(`[PDFSummarizer] Generated summary (${summary.length} characters)`);

    return summary.trim();
  } catch (error) {
    console.error('[PDFSummarizer] Error generating summary:', error);

    // Check if it's an API key error
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('API key') || errorMsg.includes('authentication') || errorMsg.includes('401')) {
      throw new Error(
        'API key is not valid. Please check that GOOGLE_API_KEY is correctly configured in your environment variables.'
      );
    }

    throw new Error(`Failed to generate summary: ${errorMsg}`);
  }
}
