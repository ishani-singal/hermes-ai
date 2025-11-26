'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PreviewFile {
  id: string
  file_url: string
  file_name: string
  file_type: string
  description?: string
}

export interface FilePreviewProps {
  file: PreviewFile | null
  files?: PreviewFile[] // For navigation between files
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FilePreview({ file, files = [], open, onOpenChange }: FilePreviewProps) {
  const [zoom, setZoom] = useState(1)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Find current index when file changes
  useEffect(() => {
    if (file && files.length > 0) {
      const idx = files.findIndex(f => f.id === file.id)
      if (idx !== -1) setCurrentIndex(idx)
    }
    setZoom(1) // Reset zoom when file changes
  }, [file, files])

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      } else if (e.key === 'ArrowLeft' && files.length > 1) {
        navigatePrev()
      } else if (e.key === 'ArrowRight' && files.length > 1) {
        navigateNext()
      } else if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(z + 0.25, 3))
      } else if (e.key === '-') {
        setZoom(z => Math.max(z - 0.25, 0.5))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, files.length, currentIndex])

  // Prevent body scroll when open
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

  if (!open || !file) return null

  const currentFile = files.length > 0 ? files[currentIndex] : file
  const isImage = currentFile.file_type.startsWith('image/')
  const isPdf = currentFile.file_type === 'application/pdf'
  const canNavigate = files.length > 1

  const navigatePrev = () => {
    setCurrentIndex(i => (i - 1 + files.length) % files.length)
    setZoom(1)
  }

  const navigateNext = () => {
    setCurrentIndex(i => (i + 1) % files.length)
    setZoom(1)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">
            {currentFile.file_name}
          </h3>
          {currentFile.description && (
            <p className="text-gray-400 text-sm truncate">
              {currentFile.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Zoom controls (images only) */}
          {isImage && (
            <>
              <button
                onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Zoom out (-)"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="text-gray-400 text-sm min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Zoom in (+)"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <div className="w-px h-6 bg-gray-700 mx-2" />
            </>
          )}

          {/* Download */}
          <a
            href={currentFile.file_url}
            download={currentFile.file_name}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </a>

          {/* Open in new tab */}
          <a
            href={currentFile.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-5 w-5" />
          </a>

          {/* Close */}
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-white transition-colors ml-2"
            title="Close (Esc)"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Navigation arrows */}
        {canNavigate && (
          <>
            <button
              onClick={navigatePrev}
              className={cn(
                "absolute left-4 p-3 rounded-full bg-black/50 text-white",
                "hover:bg-black/70 transition-colors z-10"
              )}
              title="Previous (←)"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button
              onClick={navigateNext}
              className={cn(
                "absolute right-4 p-3 rounded-full bg-black/50 text-white",
                "hover:bg-black/70 transition-colors z-10"
              )}
              title="Next (→)"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        )}

        {/* File content */}
        <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
          {isImage ? (
            <img
              src={currentFile.file_url}
              alt={currentFile.description || currentFile.file_name}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          ) : isPdf ? (
            <iframe
              src={`${currentFile.file_url}#toolbar=1&navpanes=0`}
              className="w-full h-full bg-white rounded"
              title={currentFile.file_name}
            />
          ) : (
            <div className="text-center text-gray-400">
              <p className="text-lg mb-4">Preview not available for this file type</p>
              <a
                href={currentFile.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
              >
                <ExternalLink className="h-5 w-5" />
                Open File
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Footer with navigation indicator */}
      {canNavigate && (
        <div className="flex justify-center py-3 bg-black/50">
          <div className="flex items-center gap-2">
            {files.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx)
                  setZoom(1)
                }}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  idx === currentIndex ? "bg-white" : "bg-gray-600 hover:bg-gray-400"
                )}
                title={`Go to ${idx + 1}`}
              />
            ))}
          </div>
          <span className="ml-4 text-gray-400 text-sm">
            {currentIndex + 1} / {files.length}
          </span>
        </div>
      )}
    </div>
  )
}
