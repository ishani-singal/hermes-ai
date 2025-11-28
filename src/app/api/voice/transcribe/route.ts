import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio, isSTTAvailable } from '@/mastra/services/stt-service'

export async function POST(request: NextRequest) {
    try {
        // Check if STT is available
        if (!isSTTAvailable()) {
            return NextResponse.json(
                { error: 'Speech-to-Text service is not configured' },
                { status: 503 }
            )
        }

        // Parse form data
        const formData = await request.formData()
        const audioFile = formData.get('audio') as File | null
        const languageCode = formData.get('language') as string | null

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            )
        }

        // Convert file to buffer
        const arrayBuffer = await audioFile.arrayBuffer()
        const audioBuffer = Buffer.from(arrayBuffer)

        // Determine audio encoding from MIME type
        const mimeType = audioFile.type
        let encoding: 'WEBM_OPUS' | 'MP3' | 'LINEAR16' | 'OGG_OPUS' = 'WEBM_OPUS'

        if (mimeType.includes('webm')) {
            encoding = 'WEBM_OPUS'
        } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
            encoding = 'MP3' // Google STT treats MP4/AAC as MP3
        } else if (mimeType.includes('wav')) {
            encoding = 'LINEAR16'
        } else if (mimeType.includes('ogg')) {
            encoding = 'OGG_OPUS'
        }

        console.log('[Transcribe API] Processing audio:', {
            size: audioBuffer.length,
            mimeType,
            encoding,
            language: languageCode || 'en-US',
        })

        // Transcribe audio
        const result = await transcribeAudio(audioBuffer, {
            languageCode: languageCode || 'en-US',
            encoding,
            sampleRateHertz: 48000,
        })

        return NextResponse.json({
            transcript: result.transcript,
            language: result.language,
            confidence: result.confidence,
        })
    } catch (error) {
        console.error('[Transcribe API] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Transcription failed' },
            { status: 500 }
        )
    }
}
