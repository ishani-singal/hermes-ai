import { GoogleVoice } from '@mastra/voice-google';

/**
 * Configuration options for TTS generation
 */
export interface TTSOptions {
  languageCode?: string;
  speaker?: string;
  audioEncoding?: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
}

/**
 * Result from TTS generation
 */
export interface TTSResult {
  text: string;
  audioBase64?: string;
}

/**
 * Generates text-to-speech audio using Google Cloud TTS via Mastra Voice
 * 
 * @param text - The text to convert to speech
 * @param options - Optional configuration for voice, language, and encoding
 * @returns Object containing the original text and optional base64-encoded audio
 */
export async function generateTTS(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  const {
    languageCode = 'en-US',
    speaker = 'en-US-Casual-K',
    audioEncoding = 'MP3',
  } = options;

  try {
    // Get Google Voice API key from environment
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) {
      console.warn('NEXT_PUBLIC_GOOGLE_API_KEY not configured, skipping TTS');
      return { text };
    }

    // Initialize Google Voice client
    const voice = new GoogleVoice({
      speechModel: { apiKey },
      speaker,
    });

    // Generate speech audio stream
    const audioStream = await voice.speak(text, {
      languageCode,
      audioConfig: {
        audioEncoding,
      },
    });

    if (!audioStream) {
      console.warn('Failed to generate audio stream');
      return { text };
    }

    // Convert stream to buffer
    const audioBuffer = await streamToBuffer(audioStream);

    // Encode buffer as base64
    const audioBase64 = audioBuffer.toString('base64');

    return {
      text,
      audioBase64,
    };
  } catch (error) {
    console.error('TTS generation error:', error);
    return { text };
  }
}

/**
 * Converts a readable stream to a buffer
 * 
 * @param stream - The readable stream to convert
 * @returns Buffer containing all stream data
 */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Check if TTS is available (API key is configured)
 * 
 * @returns true if TTS can be used, false otherwise
 */
export function isTTSAvailable(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
}
