/**
 * Video Parser
 * 
 * Extracts text from videos via transcription or frame analysis.
 * Placeholder for future implementation.
 */

/**
 * Parse video and extract text (transcription, captions, OCR from frames)
 * 
 * @param fileUrl - URL of the video file in Supabase Storage
 * @returns Extracted text content
 */
export async function parseVideo(fileUrl: string): Promise<string> {
  console.log(`[VideoParser] Parsing video from: ${fileUrl}`);
  
  // TODO: Implement video parsing using:
  // - Google Cloud Speech-to-Text (for audio transcription)
  // - AWS Transcribe
  // - Azure Video Indexer
  // - FFmpeg + Whisper (open source)
  // - Frame extraction + OCR for on-screen text
  
  throw new Error('Video parsing not yet implemented');
}
