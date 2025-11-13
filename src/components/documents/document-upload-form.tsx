'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Upload, X } from 'lucide-react'
import { Equipment } from '@/types'

export interface DocumentUploadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DocumentUploadForm({ open, onOpenChange, onSuccess }: DocumentUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    type: 'manual',
    scope: 'company',
    equipmentId: '',
    description: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch equipment list when dialog opens
  useEffect(() => {
    if (open) {
      fetchEquipment()
    }
  }, [open])

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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title?.trim()) {
      newErrors.title = 'Document title is required'
    } else if (formData.title.length > 255) {
      newErrors.title = 'Title must be 255 characters or less'
    }

    if (!selectedFile) {
      newErrors.file = 'Please select a file to upload'
    }

    if (formData.scope === 'equipment' && !formData.equipmentId) {
      newErrors.equipmentId = 'Please select an equipment'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Suggest title based on file name if not already set
      if (!formData.title) {
        setFormData(prev => ({
          ...prev,
          title: file.name.replace(/\.[^/.]+$/, '')
        }))
      }
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
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

    try {
      const docFormData = new FormData()
      docFormData.append('file', selectedFile!)
      docFormData.append('title', formData.title.trim())
      docFormData.append('type', formData.type)
      docFormData.append('scope', formData.scope)
      if (formData.scope === 'equipment' && formData.equipmentId) {
        docFormData.append('equipment_id', formData.equipmentId)
      }
      if (formData.description?.trim()) {
        docFormData.append('description', formData.description.trim())
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + Math.random() * 30, 90))
      }, 500)

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: docFormData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload document')
      }

      // Reset form
      setFormData({
        title: '',
        type: 'manual',
        scope: 'company',
        equipmentId: '',
        description: '',
      })
      setSelectedFile(null)
      setErrors({})

      // Close dialog and notify parent
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setUploadProgress(0)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      setFormData({
        title: '',
        type: 'manual',
        scope: 'company',
        equipmentId: '',
        description: '',
      })
      setSelectedFile(null)
      setErrors({})
      setError(null)
      setUploadProgress(0)
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload Document"
      description="Add a new document to your library"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Document Information Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Document Information</h3>

          <Input
            label="Document Title *"
            placeholder="e.g., Safety Manual for Equipment X"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            error={errors.title}
            disabled={isSubmitting}
            maxLength={255}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="doc-type" className="block text-sm font-medium text-gray-700 mb-1">
                Document Type
              </label>
              <select
                id="doc-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="manual">Operation Manual</option>
                <option value="safety">Safety Guidelines</option>
                <option value="sop">Standard Operating Procedure</option>
                <option value="troubleshooting">Troubleshooting Guide</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="doc-scope" className="block text-sm font-medium text-gray-700 mb-1">
                Scope
              </label>
              <select
                id="doc-scope"
                value={formData.scope}
                onChange={(e) => {
                  setFormData({ ...formData, scope: e.target.value, equipmentId: '' })
                  setErrors({ ...errors, equipmentId: '' })
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="company">Company-wide</option>
                <option value="equipment">Equipment-specific</option>
              </select>
            </div>
          </div>

          {/* Equipment Selector - Show only when scope is equipment */}
          {formData.scope === 'equipment' && (
            <div>
              <label htmlFor="doc-equipment" className="block text-sm font-medium text-gray-700 mb-1">
                Equipment *
              </label>
              <select
                id="doc-equipment"
                value={formData.equipmentId}
                onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
                disabled={isSubmitting || loadingEquipment}
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent ${
                  errors.equipmentId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select equipment...</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.display_id} - {eq.name}
                  </option>
                ))}
              </select>
              {errors.equipmentId && (
                <p className="mt-1 text-sm text-red-600">{errors.equipmentId}</p>
              )}
              {loadingEquipment && (
                <p className="mt-1 text-sm text-gray-500">Loading equipment...</p>
              )}
              {!loadingEquipment && equipment.length === 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  No equipment found. Create equipment first to upload equipment-specific documents.
                </p>
              )}
            </div>
          )}

          <Textarea
            label="Description"
            placeholder="Optional: Add a brief description of the document"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={isSubmitting}
            rows={2}
            maxLength={500}
          />
        </div>

        {/* File Upload Section */}
        <div className="space-y-4 pb-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Upload File</h3>

          {/* File Input */}
          <div>
            <label htmlFor="document-file-upload" className="block text-sm font-medium text-gray-700 mb-2">
              File *
            </label>
            <div className="relative">
              <input
                id="document-file-upload"
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={isSubmitting}
                className="sr-only"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.xlsx,.xls"
                aria-label="Upload document file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand hover:bg-brand/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Click to upload document"
              >
                <Upload className="h-4 w-4 mr-2 text-gray-600" />
                <span className="text-sm text-gray-600">
                  {selectedFile ? selectedFile.name : 'Click to upload file'}
                </span>
              </button>
            </div>
            {errors.file && (
              <p className="mt-1 text-sm text-red-600">{errors.file}</p>
            )}
          </div>

          {/* Selected File Display */}
          {selectedFile && (
            <div className="p-3 bg-brand/5 border border-brand/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-shrink-0 text-brand">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 16.5a.5.5 0 01-.5-.5v-5H5.707l2.147-2.146a.5.5 0 00-.707-.708l-3 3a.5.5 0 000 .708l3 3a.5.5 0 00.707-.708L5.707 11H7.5v5a.5.5 0 01-.5.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={isSubmitting}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                title="Remove file"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Upload Progress */}
          {isSubmitting && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
              </div>
              <ProgressBar progress={uploadProgress} />
            </div>
          )}

          <p className="text-xs text-gray-500">
            Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG, GIF, XLS, XLSX
          </p>
        </div>

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
            Upload Document
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
