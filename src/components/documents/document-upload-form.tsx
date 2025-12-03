'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'
import { Equipment, WorkOrder } from '@/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file

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
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    type: 'manual',
    scope: 'company',
    equipmentId: '',
    workOrderId: '',
    description: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch equipment and work orders when dialog opens
  useEffect(() => {
    if (open) {
      fetchEquipment()
      fetchWorkOrders()
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
    if (!file) return

    setError(null)

    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large. Maximum size is 10MB.')
      return
    }

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.')
      return
    }

    setSelectedFile(file)
    
    // Auto-set title from filename if empty
    if (!formData.title) {
      setFormData(prev => ({
        ...prev,
        title: file.name.replace(/\.[^/.]+$/, '')
      }))
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
    setUploadProgress(10)

    try {
      const docFormData = new FormData()
      docFormData.append('file', selectedFile!)
      docFormData.append('title', formData.title.trim())
      docFormData.append('type', formData.type)
      docFormData.append('scope', formData.scope)
      if (formData.scope === 'equipment' && formData.equipmentId) {
        docFormData.append('equipment_id', formData.equipmentId)
      }
      if (formData.workOrderId) {
        docFormData.append('work_order_id', formData.workOrderId)
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + Math.random() * 20, 90))
      }, 500)

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: docFormData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload document')
      }

      setUploadProgress(100)

      // Reset form
      resetForm()

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

  const resetForm = () => {
    setFormData({
      title: '',
      type: 'manual',
      scope: 'company',
      equipmentId: '',
      workOrderId: '',
      description: '',
    })
    setSelectedFile(null)
    setErrors({})
    setError(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      resetForm()
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
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

          {/* Work Order Selector */}
          <div>
            <label htmlFor="doc-work-order" className="block text-sm font-medium text-gray-700 mb-1">
              Link to Work Order (Optional)
            </label>
            <select
              id="doc-work-order"
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
            <input
              id="document-file-upload"
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={isSubmitting}
              className="sr-only"
              accept=".pdf"
              aria-label="Upload document file"
            />
            
            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand hover:bg-brand/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Click to upload document"
              >
                <Upload className="h-4 w-4 mr-2 text-gray-600" />
                <span className="text-sm text-gray-600">Click to select a PDF file</span>
              </button>
            ) : (
              <div className="p-3 bg-brand/5 border border-brand/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-brand flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isSubmitting}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-50 ml-2"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {errors.file && (
              <p className="mt-1 text-sm text-red-600">{errors.file}</p>
            )}
          </div>

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
            PDF files only. Maximum file size: 10MB.
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