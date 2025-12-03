/**
 * PDF Summarizer
 * 
 * Generates AI-powered summaries of PDF documents using Gemini.
 * Extracts key information: document type, topics, equipment, safety warnings.
 * Also extracts structured equipment information for automatic equipment creation.
 */

import { getGeminiClient } from '@/lib/ai/gemini-client';
import type { ExtractedEquipmentInfo } from '@/types/document';

/**
 * Result from document analysis including summary and extracted equipment info
 */
export interface DocumentAnalysisResult {
  summary: string;
  extractedEquipment: ExtractedEquipmentInfo | null;
  documentType: string;
  pageCount?: number;
  wasSmartTruncated: boolean;
}

/**
 * Smart text selection for large documents
 * For equipment extraction, we focus on pages most likely to contain equipment info:
 * - First 2 pages (cover, table of contents, intro with equipment name)
 * - Last 2 pages (specifications, model info, serial numbers)
 * - Pages with keywords like "specifications", "model", "serial"
 * 
 * @param text - Full document text
 * @param maxChars - Maximum characters to return
 * @returns Selected text optimized for equipment extraction
 */
function smartSelectText(text: string, maxChars: number = 20000): { text: string; wasSmartTruncated: boolean } {
  if (text.length <= maxChars) {
    return { text, wasSmartTruncated: false };
  }

  console.log(`[PDFSummarizer] Smart selecting from ${text.length} characters`);

  // Split into rough "pages" (assuming ~3000 chars per page)
  const pageSize = 3000;
  const pages: string[] = [];
  for (let i = 0; i < text.length; i += pageSize) {
    pages.push(text.substring(i, i + pageSize));
  }

  const selectedParts: string[] = [];
  let currentLength = 0;
  const targetLength = maxChars - 500; // Leave room for markers

  // Priority 1: First 2 pages (cover, intro, equipment name)
  for (let i = 0; i < Math.min(2, pages.length) && currentLength < targetLength * 0.4; i++) {
    selectedParts.push(`[PAGE ${i + 1}]\n${pages[i]}`);
    currentLength += pages[i].length;
  }

  // Priority 2: Last 2 pages (specifications, model info)
  const lastPages: string[] = [];
  for (let i = Math.max(pages.length - 2, 2); i < pages.length && currentLength < targetLength * 0.7; i++) {
    lastPages.push(`[PAGE ${i + 1}]\n${pages[i]}`);
    currentLength += pages[i].length;
  }

  // Priority 3: Pages with equipment-related keywords
  const keywords = /specification|model|serial|manufacturer|part\s*number|equipment|rating|capacity/i;
  for (let i = 2; i < pages.length - 2 && currentLength < targetLength; i++) {
    if (keywords.test(pages[i])) {
      selectedParts.push(`[PAGE ${i + 1} - SPECIFICATIONS]\n${pages[i]}`);
      currentLength += pages[i].length;
    }
  }

  // Add last pages at the end
  selectedParts.push(...lastPages);

  const result = selectedParts.join('\n\n---\n\n');
  console.log(`[PDFSummarizer] Smart selected ${result.length} characters from ${pages.length} pages`);

  return { 
    text: result + '\n\n[Document smart-truncated for analysis - focused on equipment-relevant sections]',
    wasSmartTruncated: true 
  };
}

/**
 * Generate a structured summary of a PDF document
 * 
 * @param text - Raw text extracted from PDF
 * @param fileName - Original filename for context
 * @returns Structured summary of the document
 */
export async function summarizeDocument(text: string, fileName?: string): Promise<string> {
  const genAI = getGeminiClient();

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

/**
 * Analyze document and extract both summary and structured equipment information
 * Uses smart text selection for large documents to focus on equipment-relevant pages.
 * 
 * @param text - Raw text extracted from PDF
 * @param fileName - Original filename for context
 * @returns DocumentAnalysisResult with summary and extracted equipment info
 */
export async function analyzeDocumentWithExtraction(
  text: string, 
  fileName?: string
): Promise<DocumentAnalysisResult> {
  const genAI = getGeminiClient();

  console.log(`[PDFSummarizer] Analyzing document with extraction (${text.length} characters)`);

  // Use smart text selection for large documents
  const { text: selectedText, wasSmartTruncated } = smartSelectText(text, 20000);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analyze this technical document and extract structured information.

${fileName ? `FILENAME: ${fileName}\n` : ''}
DOCUMENT TEXT:
${selectedText}

Respond with a JSON object in this exact format:
{
  "summary": "A concise 200-300 word summary covering: document type, main topics (3-5 bullet points), key safety warnings if any, and what this document is useful for.",
  "documentType": "manual|safety|sop|troubleshooting|specification|other",
  "equipment": {
    "name": "The primary equipment name this document is about (e.g., 'GE Profile Gas Range', 'Carrier 24ACC636A003')",
    "manufacturer": "The manufacturer/brand name (e.g., 'GE', 'Carrier', 'Trane')",
    "model": "The model number (e.g., 'PGS930', '24ACC636A003')",
    "type": "The equipment type/category (e.g., 'gas range', 'air conditioner', 'heat pump', 'refrigerator')",
    "serial_number": "Serial number if found in the document (usually null for manuals)",
    "confidence": "high|medium|low - based on how clearly the equipment info was stated"
  }
}

Rules:
- If the document is NOT about a specific piece of equipment (e.g., general safety guide, company SOP), set equipment to null
- Only include equipment fields that are clearly stated in the document
- Use null for any field not found
- confidence should be "high" if manufacturer AND model are clearly stated, "medium" if only some info is clear, "low" if mostly inferred
- For name, combine manufacturer and model if both present, or use the most descriptive name from the document`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    if (!responseText || responseText.trim().length === 0) {
      throw new Error('No response generated');
    }

    // Parse JSON response - handle markdown code blocks
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    console.log(`[PDFSummarizer] Extracted equipment info:`, parsed.equipment);

    // Map to our type
    const extractedEquipment: ExtractedEquipmentInfo | null = parsed.equipment ? {
      name: parsed.equipment.name || undefined,
      manufacturer: parsed.equipment.manufacturer || undefined,
      model: parsed.equipment.model || undefined,
      type: parsed.equipment.type || undefined,
      serial_number: parsed.equipment.serial_number || undefined,
      confidence: parsed.equipment.confidence || 'low',
    } : null;

    return {
      summary: parsed.summary || '',
      extractedEquipment,
      documentType: parsed.documentType || 'other',
      wasSmartTruncated,
    };
  } catch (error) {
    console.error('[PDFSummarizer] Error analyzing document:', error);

    // Check if it's an API key error
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('API key') || errorMsg.includes('authentication') || errorMsg.includes('401')) {
      throw new Error(
        'API key is not valid. Please check that GOOGLE_API_KEY is correctly configured in your environment variables.'
      );
    }

    // Fallback: try simple summarization without extraction
    console.log('[PDFSummarizer] Falling back to simple summarization');
    try {
      const fallbackSummary = await summarizeDocument(text, fileName);
      return {
        summary: fallbackSummary,
        extractedEquipment: null,
        documentType: 'other',
        wasSmartTruncated,
      };
    } catch {
      throw new Error(`Failed to analyze document: ${errorMsg}`);
    }
  }
}
