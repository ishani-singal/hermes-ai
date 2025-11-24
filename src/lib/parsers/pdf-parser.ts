/**
 * PDF Parser
 * 
 * Extracts text content from PDF files.
 * Uses pdf-parse library (configured as external package in next.config.ts).
 */

import { PDFParse } from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Download file from Supabase Storage
 */
async function downloadFile(fileUrl: string): Promise<Buffer> {
  try {
    // Extract bucket and path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/storage/v1/object/public/');
    if (pathParts.length < 2) {
      throw new Error('Invalid Supabase storage URL');
    }
    
    const [bucket, ...pathSegments] = pathParts[1].split('/');
    const path = pathSegments.join('/');

    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('No file data returned');
    }

    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    console.error('[PDFParser] Error downloading file:', error);
    throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(fileBuffer: Buffer): Promise<{ text: string; numPages: number }> {
  try {
    // Create parser instance with the buffer
    const parser = new PDFParse({ data: fileBuffer });
    
    // Extract text from all pages
    const textResult = await parser.getText();
    
    // Get total page count from info
    const infoResult = await parser.getInfo();
    
    // Cleanup - free memory
    await parser.destroy();
    
    return {
      text: textResult.text,
      numPages: infoResult.total,
    };
  } catch (error) {
    console.error('[PDFParser] Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse PDF file and extract text content
 * 
 * @param fileUrl - URL of the PDF file in Supabase Storage
 * @returns Extracted text content
 */
export async function parsePDF(fileUrl: string): Promise<string> {
  console.log(`[PDFParser] Parsing PDF from: ${fileUrl}`);
  
  // Download file
  const fileBuffer = await downloadFile(fileUrl);
  
  // Extract text
  const { text, numPages } = await extractTextFromPDF(fileBuffer);
  
  if (!text || text.trim().length === 0) {
    throw new Error('No text extracted from PDF');
  }
  
  console.log(`[PDFParser] Extracted ${text.length} characters from ${numPages} pages`);
  
  return text;
}
