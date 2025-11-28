'use client'

import { ConversationState } from '@/lib/voice/types'

interface ConversationStateIndicatorProps {
    state: ConversationState
    error?: string | null
}

export function ConversationStateIndicator({ state, error }: ConversationStateIndicatorProps) {
    const stateConfig = {
        idle: {
            icon: '👋',
            text: 'Ready to chat',
            className: 'text-gray-600',
        },
        recording: {
            icon: '🎤',
            text: 'Listening...',
            className: 'text-red-600 animate-pulse',
        },
        processing: {
            icon: '🤔',
            text: 'Thinking...',
            className: 'text-blue-600',
        },
        speaking: {
            icon: '🔊',
            text: 'Speaking...',
            className: 'text-green-600 animate-pulse',
        },
        error: {
            icon: '❌',
            text: error || 'Something went wrong',
            className: 'text-red-600',
        },
    }

    const config = stateConfig[state]

    return (
        <div className="flex items-center justify-center gap-2 py-2 px-4">
            <span className="text-2xl" aria-hidden="true">{config.icon}</span>
            <span className={`text-sm font-medium ${config.className}`}>
                {config.text}
            </span>
            {state === 'processing' && (
                <div className="ml-2 flex gap-1">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            )}
        </div>
    )
}
