import { NextRequest, NextResponse } from 'next/server'

/**
 * Voice Conversation Turn Endpoint
 * 
 * Simplified wrapper that calls /api/ai.
 * 
 * TODO: Add automatic language detection in the future
 * For now, we're focusing on solidifying the English language experience
 * Once stable, we'll add auto-detection and enable translation
 * 
 * Flow:
 * 1. Accept transcribed text (always in English for now)
 * 2. Call /api/ai with proper auth headers
 * 3. Return response with audio (in English)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { message, threadId } = body
        // Language parameter is ignored for now - always use English

        if (!message) {
            return NextResponse.json(
                { error: 'No message provided' },
                { status: 400 }
            )
        }

        // Always use English for now
        const language = 'en-US'
        console.log(`[Turn API] Processing: "${message}" (${language})`)

        // Call /api/ai internally with proper auth
        const baseUrl = process.env.INTERNAL_API_BASE_URL || 'http://localhost:3000'
        const aiUrl = `${baseUrl}/api/ai`

        const aiResponse = await fetch(aiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
                message,
                threadId: threadId || undefined,
                streamMode: true,  // VOICE mode
                language,  // Always English
            }),
        })

        if (!aiResponse.ok) {
            const errorText = await aiResponse.text()
            console.error('[Turn API] AI call failed:', errorText)
            throw new Error(`AI processing failed: ${errorText}`)
        }

        const aiData = await aiResponse.json()

        const aiResponseText = aiData?.assistant?.text ?? aiData?.data?.assistant?.text ?? ''
        const audioBase64 = aiData?.assistant?.audioBase64 ?? aiData?.data?.assistant?.audioBase64

        if (!aiResponseText) {
            console.error('[Turn API] Could not find text in response')
            throw new Error('No response from AI')
        }

        console.log(`[Turn API] Response ready, audio present: ${!!audioBase64}`)

        return NextResponse.json({
            transcript: message,
            response: aiResponseText,
            audioBase64: audioBase64,
            language  // Always English
        })

    } catch (error) {
        console.error('[Turn API] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
