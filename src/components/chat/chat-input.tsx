import { Send, Mic, Radio, StopCircle } from 'lucide-react'

type ChatInputProps = {
  input: string
  setInput: (value: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  listening: boolean
  onMicClick: () => void
  onStreamClick: () => void
  loading: boolean
  streamMode: boolean
  pushToTalkMode: boolean
  isTTSPlaying: boolean
  onStopTTS: () => void
}

export function ChatInput({
  input,
  setInput,
  onSend,
  onKeyDown,
  listening,
  onMicClick,
  onStreamClick,
  loading,
  streamMode,
  pushToTalkMode,
  isTTSPlaying,
  onStopTTS,
}: ChatInputProps) {
  const placeholderText = listening ? 'You can start talking now' : 'Type your question here'
  
  // Disable send button when:
  // 1. Loading (awaiting response)
  // 2. In stream mode (auto-send is enabled)
  // 3. Listening in push-to-talk mode
  // 4. TTS is playing
  const isSendDisabled = loading || streamMode || (listening && pushToTalkMode) || isTTSPlaying

  return (
    <div className="mt-4">
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholderText}
          className="flex-1 min-h-[54px] p-3 rounded-md border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Chat message"
        />
        <div className="flex items-center gap-2">
          {isTTSPlaying && (
            <button
              onClick={onStopTTS}
              title="Stop audio playback"
              className="inline-flex items-center justify-center p-3 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors animate-pulse"
            >
              <StopCircle className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={onSend}
            disabled={isSendDisabled}
            title={isSendDisabled ? (streamMode ? 'Send disabled in continuous mode' : 'Finish speaking first') : 'Send message'}
            className="inline-flex items-center justify-center p-3 rounded-md bg-brand text-white hover:brightness-110 disabled:opacity-60 transition-all"
          >
            <Send className="h-5 w-5" />
          </button>
          <button
            onClick={onMicClick}
            title={listening && pushToTalkMode ? 'Stop voice input' : 'Start voice input (push-to-talk)'}
            className={
              'inline-flex items-center justify-center p-3 rounded-md border transition-colors ' +
              (listening && pushToTalkMode ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
            }
          >
            <span className={listening && pushToTalkMode ? 'animate-pulse' : ''}>
              <Mic className="h-5 w-5" />
            </span>
          </button>
          <button
            onClick={onStreamClick}
            title={streamMode && listening ? 'Stop continuous conversation' : 'Start continuous conversation'}
            className={
              'inline-flex items-center justify-center p-3 rounded-md border transition-colors ' +
              (streamMode && listening
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
            }
          >
            <span className={streamMode && listening ? 'animate-pulse' : ''}>
              <Radio className="h-5 w-5" />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
