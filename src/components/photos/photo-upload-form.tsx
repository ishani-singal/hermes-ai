'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Upload, X, Camera, AlertCircle } from 'lucide-react'
import { Equipment, WorkOrder } from '@/types'

export interface PhotoUploadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function PhotoUploadForm({ open, onOpenChange, onSuccess }: PhotoUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState<'uploading' | 'analyzing' | 'indexing' | null>(null)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false)

  const [formData, setFormData] = useState({
    description: '',
    equipmentId: '',
    workOrderId: '',
    linkType: 'reference' as 'profile' | 'reference' | 'before' | 'after' | 'evidence' | 'other',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch equipment and work orders when dialog opens
  useEffect(() => {
    if (open) {
      fetchEquipment()
      fetchWorkOrders()
    }
  }, [open])

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const fetchEquipment = async () => {
    setLoadingEquipment(true)
    try {
      const response = await fetch('/api/equipment')
      if (response.ok) {
        const data = await response.json()
        setEquipment(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch equipment:', err)
    } finally {
      setLoadingEquipment(false)
    }
  }

  const fetchWorkOrders = async () => {
    setLoadingWorkOrders(true)
    try {
      const response = await fetch('/api/work-orders?status=open,in_progress')
      if (response.ok) {
        const data = await response.json()
        setWorkOrders(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch work orders:', err)
    } finally {
      setLoadingWorkOrders(false)
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!selectedFile) {
      newErrors.file = 'Please select a photo to upload'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']
      if (!allowedTypes.includes(file.type)) {
        setErrors({ file: 'Only image files (JPEG, PNG, GIF, WebP, HEIC) are supported' })
        return
      }

      // Validate file size (20MB max)
      if (file.size > 20 * 1024 * 1024) {
        setErrors({ file: 'File size must be less than 20MB' })
        return
      }

      setSelectedFile(file)
      setErrors({})
      
      // Create preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setUploadProgress(0)
    setUploadStage('uploading')

    try {
      const photoFormData = new FormData()
      photoFormData.append('file', selectedFile!)
      if (formData.description?.trim()) {
        photoFormData.append('description', formData.description.trim())
      }
      if (formData.equipmentId) {
        photoFormData.append('equipment_id', formData.equipmentId)
      }
      if (formData.workOrderId) {
        photoFormData.append('work_order_id', formData.workOrderId)
      }
      photoFormData.append('link_type', formData.linkType)
      // Flag to trigger immediate analysis
      photoFormData.append('analyze_immediately', 'true')

      // Simulate initial upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 30) return prev + Math.random() * 10
          return prev
        })
      }, 200)

      // Upload photo (will analyze and queue for RAG on server)
      const response = await fetch('/api/photos', {
        method: 'POST',
        body: photoFormData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload photo')
      }

      const result = await response.json()

      // Show analysis stage
      setUploadStage('analyzing')
      setUploadProgress(60)

      // Check if analysis was completed
      if (result.status === 'ready' || result.status === 'processing') {
        setUploadStage('indexing')
        setUploadProgress(90)
      }

      // Complete
      setUploadProgress(100)

      // Reset form
      setFormData({
        description: '',
        equipmentId: '',
        workOrderId: '',
        linkType: 'reference',
      })
      setSelectedFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setErrors({})

      // Close dialog and notify parent
      setTimeout(() => {
        onOpenChange(false)
        onSuccess()
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setUploadProgress(0)
      setUploadStage(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      setFormData({
        description: '',
        equipmentId: '',
        workOrderId: '',
        linkType: 'reference',
      })
      setSelectedFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setErrors({})
      setError(null)
      setUploadProgress(0)
      setUploadStage(null)
      onOpenChange(false)
    }
  }

  const getStageLabel = () => {
    switch (uploadStage) {
      case 'uploading':
        return 'Uploading photo...'
      case 'analyzing':
        return 'Analyzing with AI...'
      case 'indexing':
        return 'Indexing for search...'
      default:
        return 'Processing...'
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload Photo"
      description="Add a photo for AI analysis and search"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Photo Upload Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Photo</h3>

          {/* File Input */}
          <div>
            <input
              id="photo-file-upload"
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              className="sr-only"
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
              aria-label="Upload photo file"
            />
            
            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full flex flex-col items-center justify-center px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand hover:bg-brand/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera className="h-8 w-8 mb-2 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Click to upload photo</span>
                <span className="text-xs text-gray-400 mt-1">JPEG, PNG, GIF, WebP, HEIC (max 20MB)</span>
              </button>
            ) : (
              <div className="relative rounded-lg overflow-hidden bg-gray-100">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full max-h-64 object-contain"
                  />
                )}
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isSubmitting}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-50"
                  title="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
                  <p className="text-sm text-white truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-300">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            )}
            {errors.file && (
              <p className="mt-1 text-sm text-red-600">{errors.file}</p>
            )}
          </div>
        </div>

        {/* Optional Details Section */}
        <div className="space-y-4 pb-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Details (Optional)</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="photo-equipment" className="block text-sm font-medium text-gray-700 mb-1">
                Link to Equipment
              </label>
              <select
                id="photo-equipment"
                value={formData.equipmentId}
                onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
                disabled={isSubmitting || loadingEquipment}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="">No equipment</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.display_id} - {eq.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="photo-work-order" className="block text-sm font-medium text-gray-700 mb-1">
                Link to Work Order
              </label>
              <select
                id="photo-work-order"
                value={formData.workOrderId}
                onChange={(e) => setFormData({ ...formData, workOrderId: e.target.value })}
                disabled={isSubmitting || loadingWorkOrders}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="">No work order</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.display_id} - {wo.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="photo-link-type" className="block text-sm font-medium text-gray-700 mb-1">
                Photo Type
              </label>
              <select
                id="photo-link-type"
                value={formData.linkType}
                onChange={(e) => setFormData({ ...formData, linkType: e.target.value as typeof formData.linkType })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="reference">Reference Photo</option>
                <option value="profile">Equipment Profile</option>
                <option value="before">Before (Repair)</option>
                <option value="after">After (Repair)</option>
                <option value="evidence">Issue Evidence</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <Textarea
            label="Description"
            placeholder="Optional: Add notes about this photo"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={isSubmitting}
            rows={2}
            maxLength={500}
          />
        </div>

        {/* Upload Progress */}
        {isSubmitting && uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{getStageLabel()}</span>
              <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
            </div>
            <ProgressBar progress={uploadProgress} />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting || !selectedFile}
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload Photo
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
