/**
 * Image Parser
 * 
 * Analyzes images using Gemini Vision for both OCR and scene understanding.
 * Provides rich descriptions for maintenance and troubleshooting context.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Image Analysis Result Interface
 */
export interface ImageAnalysisResult {
  /** Natural language description of the scene */
  description: string;
  /** Extracted text from OCR */
  ocrText: string;
  /** Detected serial numbers, model numbers, part IDs */
  extractedIdentifiers: string[];
  /** Visible damage indicators */
  damageIndicators: string[];
  /** Technical observations (gauges, measurements, conditions) */
  observations: string[];
}

/**
 * Initialize Gemini client
 */
function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Convert image URL to base64 data
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ mimeType: string; data: string }> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Get MIME type from response headers or infer from URL
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    return {
      mimeType,
      data: base64,
    };
  } catch (error) {
    console.error('[ImageParser] Error fetching image:', error);
    throw new Error(`Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse image with Gemini Vision for OCR + Scene Analysis
 * 
 * @param fileUrl - Public URL of the image file in Supabase Storage
 * @returns Extracted text description combining OCR and scene understanding
 */
export async function parseImage(fileUrl: string): Promise<string> {
  console.log(`[ImageParser] Analyzing image with Gemini Vision: ${fileUrl}`);

  try {
    const genAI = getGeminiClient();
    // Use gemini-2.5-flash - stable model with vision support, available in free tier
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Fetch image as base64
    const imageData = await fetchImageAsBase64(fileUrl);

    // Craft prompt for maintenance/technical context
    const prompt = `You are analyzing equipment photos for maintenance technicians. Provide a concise, technical description including:

1. What equipment or objects are visible
2. Their condition (new, worn, damaged, corroded, etc.)
3. Any visible text, labels, serial numbers, model numbers, or part IDs
4. Gauge readings or measurements if present
5. Any damage indicators (rust, leaks, cracks, wear)
6. Safety concerns if any

Be specific and technical. Focus on details that would help a technician troubleshoot or repair the equipment.

Limit response to 280 characters for the main description.`;

    // Call Gemini with the image
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data,
        },
      },
    ]);

    const response = result.response;
    const description = response.text();

    if (!description || description.trim().length === 0) {
      console.log('[ImageParser] No description generated');
      return '';
    }

    console.log(`[ImageParser] Generated description: ${description.length} characters`);

    return description.trim();

  } catch (error) {
    console.error('[ImageParser] Error analyzing image with Gemini:', error);
    throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse image with detailed structured analysis (for future advanced features)
 * 
 * @param fileUrl - Public URL of the image file in Supabase Storage
 * @returns Detailed analysis with structured data
 */
export async function parseImageDetailed(fileUrl: string): Promise<ImageAnalysisResult> {
  console.log(`[ImageParser] Analyzing image (detailed) with Gemini Vision: ${fileUrl}`);

  try {
    const genAI = getGeminiClient();
    // Use gemini-2.5-flash - stable model with vision support, available in free tier
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Fetch image as base64
    const imageData = await fetchImageAsBase64(fileUrl);

    // Craft prompt for structured output
    const prompt = `Analyze this equipment photo and provide a structured technical analysis in JSON format with these fields:

{
  "description": "Brief technical description (280 chars max)",
  "ocrText": "All visible text, labels, numbers extracted",
  "extractedIdentifiers": ["serial numbers", "model numbers", "part IDs"],
  "damageIndicators": ["rust", "leak", "crack", "wear", etc.],
  "observations": ["gauge readings", "measurements", "technical details"]
}

Be specific and technical. Return ONLY valid JSON.`;

    // Call Gemini with the image
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data,
        },
      },
    ]);

    const response = result.response;
    const jsonText = response.text().trim();

    // Try to parse JSON response
    let analysisData: ImageAnalysisResult;
    try {
      // Remove markdown code blocks if present
      const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '').trim();
      analysisData = JSON.parse(cleanJson);
    } catch {
      // Fallback to simple description if JSON parsing fails
      console.warn('[ImageParser] Failed to parse JSON response, using simple description');
      analysisData = {
        description: jsonText.substring(0, 280),
        ocrText: '',
        extractedIdentifiers: [],
        damageIndicators: [],
        observations: [],
      };
    }

    console.log(`[ImageParser] Generated detailed analysis`);

    return analysisData;

  } catch (error) {
    console.error('[ImageParser] Error analyzing image with Gemini:', error);
    throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
