import { LanguageOption } from './types'

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸', ttsVoice: 'en-US-Casual-K' },
    { code: 'es-ES', name: 'Spanish (Español)', flag: '🇪🇸', ttsVoice: 'es-ES-Neural2-A' },
    { code: 'fr-FR', name: 'French (Français)', flag: '🇫🇷', ttsVoice: 'fr-FR-Neural2-A' },
    { code: 'de-DE', name: 'German (Deutsch)', flag: '🇩🇪', ttsVoice: 'de-DE-Neural2-B' },
    { code: 'it-IT', name: 'Italian (Italiano)', flag: '🇮🇹', ttsVoice: 'it-IT-Neural2-A' },
    { code: 'pt-BR', name: 'Portuguese (Português)', flag: '🇧🇷', ttsVoice: 'pt-BR-Neural2-A' },
    { code: 'hi-IN', name: 'Hindi (हिन्दी)', flag: '🇮🇳', ttsVoice: 'hi-IN-Neural2-A' },
    { code: 'ja-JP', name: 'Japanese (日本語)', flag: '🇯🇵', ttsVoice: 'ja-JP-Neural2-B' },
    { code: 'ko-KR', name: 'Korean (한국어)', flag: '🇰🇷', ttsVoice: 'ko-KR-Neural2-A' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳', ttsVoice: 'cmn-CN-Neural2-A' },
]
