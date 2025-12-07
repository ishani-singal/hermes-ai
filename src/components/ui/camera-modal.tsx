'use client'

import { useEffect, useRef, useState } from 'react'
import { X, RefreshCw } from 'lucide-react'

interface CameraModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
}

export function CameraModal({ open, onOpenChange, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  // Lock body scroll when camera is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  useEffect(() => {
    if (open) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode])

  const startCamera = async () => {
    try {
      setError(null)
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      
      setStream(newStream)
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setError('Could not access camera. Please ensure you have granted camera permissions.')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // Draw video frame to canvas
      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Convert to file
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
            onCapture(file)
            onOpenChange(false)
          }
        }, 'image/jpeg', 0.9)
      }
    }
  }

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }

  const handleClose = () => {
    stopCamera()
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header with close button */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <h2 className="text-white font-semibold text-lg">Take Photo</h2>
        <button
          onClick={handleClose}
          className="p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
          aria-label="Close camera"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Camera viewfinder - takes full available space */}
      <div className="flex-1 relative flex items-center justify-center">
        {error ? (
          <div className="text-white p-4 text-center">
            <p className="mb-4">{error}</p>
            <button 
              onClick={() => startCamera()}
              className="px-6 py-3 bg-white text-black rounded-lg text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Camera controls at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pb-8 pt-4 bg-gradient-to-t from-black/50 to-transparent">
        <div className="flex justify-center items-center gap-8">
          <button
            onClick={toggleCamera}
            className="p-4 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
            title="Switch camera"
          >
            <RefreshCw className="h-6 w-6" />
          </button>
          
          <button
            onClick={handleCapture}
            className="p-2 rounded-full bg-white hover:scale-105 transition-transform shadow-lg"
            title="Capture photo"
            disabled={!!error}
          >
            <div className="h-16 w-16 rounded-full border-4 border-brand flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-brand" />
            </div>
          </button>
          
          {/* Spacer for centering */}
          <div className="w-14 h-14" />
        </div>
      </div>
    </div>
  )
}
