'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, StopCircle, Plus, Camera, Image as ImageIcon, FileText, Radio } from 'lucide-react'
import { CameraModal } from '@/components/ui/camera-modal'

type ChatInputProps = {
  input: string
  setInput: (value: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  listening: boolean
  onTurnByTurnClick?: () => void
  loading: boolean
  streamMode: boolean
  turnByTurnMode?: boolean
  isTTSPlaying?: boolean
  onStopTTS?: () => void
  onPhotoSelect?: (file: File) => void
  onDocumentSelect?: (file: File) => void
}

export function ChatInput({
  input,
  setInput,
  onSend,
  onKeyDown,
  listening,
  onTurnByTurnClick,
  loading,
  streamMode,
  isTTSPlaying,
  onPhotoSelect,
  onDocumentSelect,
}: ChatInputProps) {
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [hasCameraDevice, setHasCameraDevice] = useState<boolean | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  // Check for camera availability on mount
  useEffect(() => {
    const checkCamera = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const videoDevices = devices.filter(device => device.kind === 'videoinput')
          setHasCameraDevice(videoDevices.length > 0)
        } else {
          setHasCameraDevice(false)
        }
      } catch {
        // If we can't check, assume camera might be available
        setHasCameraDevice(true)
      }
    }
    void checkCamera()
  }, [])

  const placeholderText = listening ? 'You can start talking now' : 'Type your question here'

  // Disable send button when:
  // 1. Loading (awaiting response)
  // 2. In stream mode (auto-send is enabled)
  // 3. TTS is playing
  const isSendDisabled = loading || streamMode || isTTSPlaying

  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onPhotoSelect) {
      onPhotoSelect(file)
      setShowAttachMenu(false)
    }
    if (e.target) {
      e.target.value = ''
    }
  }

  const handleDocumentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onDocumentSelect) {
      onDocumentSelect(file)
      setShowAttachMenu(false)
    }
    if (e.target) {
      e.target.value = ''
    }
  }

  const handleCameraClick = () => {
    if (hasCameraDevice === false) {
      alert('No camera detected on this device.')
      setShowAttachMenu(false)
      return
    }
    setShowCameraModal(true)
    setShowAttachMenu(false)
  }

  const handleCameraCapture = (file: File) => {
    if (onPhotoSelect) {
      onPhotoSelect(file)
    }
  }

  const handleUploadPhotoClick = () => {
    photoInputRef.current?.click()
    setShowAttachMenu(false)
  }

  const handleUploadDocumentClick = () => {
    documentInputRef.current?.click()
    setShowAttachMenu(false)
  }

  return (
    <div className="px-4 py-3 sm:mt-4">
      <div className="flex gap-2 items-stretch">
        {/* Attachment button */}
        <div className="relative flex items-stretch">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            title="Attach photo"
            className="inline-flex items-center justify-center w-[46px] h-[46px] rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            aria-label="Attach photo"
          >
            <Plus className="h-5 w-5" />
          </button>

          {/* Attachment menu */}
          {showAttachMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAttachMenu(false)}
              />
              <div className="absolute bottom-full left-0 mb-2 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[180px] z-20">
                <button
                  onClick={handleCameraClick}
                  disabled={hasCameraDevice === false}
                  className={
                    "w-full px-4 py-2 text-left text-sm flex items-center gap-3 " +
                    (hasCameraDevice === false
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-700 hover:bg-gray-50")
                  }
                  title={hasCameraDevice === false ? "No camera detected" : "Take a photo"}
                >
                  <Camera className="h-4 w-4" />
                  Take Photo
                </button>
                <button
                  onClick={handleUploadPhotoClick}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <ImageIcon className="h-4 w-4" />
                  Upload Photo
                </button>
                <button
                  onClick={handleUploadDocumentClick}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <FileText className="h-4 w-4" />
                  Upload Document
                </button>
              </div>
            </>
          )}

          {/* Hidden file inputs */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoFileSelect}
            className="hidden"
            aria-label="Photo upload input"
          />
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleDocumentFileSelect}
            className="hidden"
            aria-label="Document upload input"
          />
        </div>

        <CameraModal
          open={showCameraModal}
          onOpenChange={setShowCameraModal}
          onCapture={handleCameraCapture}
        />

        {/* Text input - now with word wrap */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholderText}
          rows={1}
          className="flex-1 h-[46px] min-h-[46px] max-h-[200px] py-3 px-3 rounded-md border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = '46px'
            target.style.height = Math.min(target.scrollHeight, 200) + 'px'
          }}
          aria-label="Chat message"
        />

        {/* Action buttons - all same height */}
        <div className="flex items-stretch gap-2">
          <button
            onClick={onSend}
            disabled={isSendDisabled}
            title={isSendDisabled ? (streamMode ? 'Send disabled in continuous mode' : 'Finish speaking first') : 'Send message'}
            className="inline-flex items-center justify-center w-[46px] h-[46px] rounded-md bg-brand text-white hover:brightness-110 disabled:opacity-60 transition-all"
          >
            <Send className="h-5 w-5" />
          </button>
          {onTurnByTurnClick && (
            <button
              onClick={onTurnByTurnClick}
              title={listening || loading || isTTSPlaying ? 'Stop conversation' : 'Start turn-by-turn conversation'}
              className={
                'inline-flex items-center justify-center w-[46px] h-[46px] rounded-md transition-colors ' +
                (listening || loading || isTTSPlaying
                  ? 'bg-red-600 text-white border-2 border-red-700 shadow-lg shadow-red-500/50'
                  : 'bg-green-100 text-green-700 border-2 border-green-300 hover:bg-green-200')
              }
            >
              <span className={listening || loading || isTTSPlaying ? 'animate-pulse' : ''}>
                {listening || loading || isTTSPlaying ? (
                  <StopCircle className="h-5 w-5" />
                ) : (
                  <Radio className="h-5 w-5" />
                )}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
