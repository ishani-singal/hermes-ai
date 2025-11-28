import { GoogleGenerativeAI, GenerateContentResult } from '@google/generative-ai'

/**
 * Translates text from one language to another using Google Gemini
 * 
 * @param text - The text to translate
 * @param fromLang - Source language code (e.g., 'en', 'es', 'hi')
 * @param toLang - Target language code
 * @returns Translated text
 */
export async function translateText(
    text: string,
    fromLang: string,
    toLang: string
): Promise<string> {
    // If same language, no translation needed
    if (fromLang.startsWith(toLang) || toLang.startsWith(fromLang)) {
        return text
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
        console.warn('GOOGLE_GENERATIVE_AI_API_KEY not configured, skipping translation')
        return text
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const languageNames: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'hi': 'Hindi',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
    }

    const fromLangName = languageNames[fromLang.split('-')[0]] || fromLang
    const toLangName = languageNames[toLang.split('-')[0]] || toLang

    const prompt = `You are a professional technical translator. Translate the following text from ${fromLangName} to ${toLangName}.
    
CRITICAL RULES:
1. Preserve ALL technical terms, proper nouns, brand names, and model numbers EXACTLY as they appear.
2. Do NOT translate English technical terms if the target language is not English.
3. Support "Hinglish" or mixed-language input: if the input mixes ${fromLangName} with English terms, keep the English terms unchanged.
4. Only translate the grammatical structure and common words.
5. Return ONLY the translated text, no explanations or markdown.

Examples:
Input (Spanish): "El Compressor 3000 no arranca."
Output (English): "The Compressor 3000 does not start."

Input (Spanish): "Necesito revisar el status del HVAC system."
Output (English): "I need to check the status of the HVAC system."

Input (Hindi): "Water pump ka pressure check karna hai."
Output (English): "I need to check the pressure of the water pump."

Input (English): "Check the voltage on the Grundfos pump."
Output (Spanish): "Verifique el voltaje en la bomba Grundfos."

Text to translate: "${text}"`

    // Retry configuration
    const MAX_RETRIES = 3
    const TIMEOUT_MS = 15000

    let lastError: unknown

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Create a timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Translation request timed out')), TIMEOUT_MS)
            })

            // Race the generation against the timeout
            const result = await Promise.race([
                model.generateContent(prompt),
                timeoutPromise
            ]) as GenerateContentResult

            const translation = result.response.text().trim()

            console.debug('[Translation] Success:', {
                from: fromLangName,
                to: toLangName,
                attempt,
                originalLength: text.length,
                translatedLength: translation.length,
            })

            return translation
        } catch (error) {
            console.warn(`[Translation] Attempt ${attempt} failed:`, error)
            lastError = error
            // Wait briefly before retry (exponential backoff could be added here)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
    }

    console.error('[Translation] All attempts failed. Returning original text.', lastError)
    return text
}
