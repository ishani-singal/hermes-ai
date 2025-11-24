'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, RefreshCw } from 'lucide-react'
import { Dialog } from './dialog'

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

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Take Photo"
      size="lg"
    >
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        {error ? (
          <div className="text-white p-4 text-center">
            <p className="mb-2">{error}</p>
            <button 
              onClick={() => startCamera()}
              className="px-4 py-2 bg-white text-black rounded-md text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
              <button
                onClick={toggleCamera}
                className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                title="Switch camera"
              >
                <RefreshCw className="h-6 w-6" />
              </button>
              
              <button
                onClick={handleCapture}
                className="p-4 rounded-full bg-white text-brand-primary hover:scale-105 transition-transform shadow-lg"
                title="Capture photo"
              >
                <div className="h-12 w-12 rounded-full border-4 border-brand-primary flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-brand-primary" />
                </div>
              </button>
              
              <div className="w-12" /> {/* Spacer for centering */}
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
