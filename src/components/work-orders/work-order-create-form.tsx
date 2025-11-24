'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CreateWorkOrderRequest, WorkOrderPriority, Equipment } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { localDateToUTC } from '@/lib/utils/date-timezone'
import { Upload, X } from 'lucide-react'

export interface WorkOrderCreateFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export function WorkOrderCreateForm({ open, onOpenChange, onSuccess }: WorkOrderCreateFormProps) {
  const { companies, activeCompanyId } = useAuth()
  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const isAdmin = activeCompany?.role === 'admin'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<CreateWorkOrderRequest>({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    equipment_id: '',
    assigned_to: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch users and equipment when dialog opens
  useEffect(() => {
    if (open) {
      // Fetch equipment list
      const fetchEquipment = async () => {
        try {
          setIsLoadingEquipment(true)
          const response = await fetch('/api/equipment')
          if (response.ok) {
            const data = await response.json()
            setEquipment(data.data || [])
          }
        } catch (err) {
          console.error('Failed to fetch equipment:', err)
        } finally {
          setIsLoadingEquipment(false)
        }
      }

      fetchEquipment()

      // Fetch users for admin
      if (isAdmin) {
        const fetchUsers = async () => {
          try {
            setIsLoadingUsers(true)
            const response = await fetch('/api/users')
            if (response.ok) {
              const users = await response.json() as Array<{ id: string; full_name: string }>
              const userOptions = users.map((user) => ({
                id: user.id,
                label: user.full_name,
              }))
              setUsers(userOptions)
            }
          } catch (err) {
            console.error('Failed to fetch users:', err)
          } finally {
            setIsLoadingUsers(false)
          }
        }

        fetchUsers()
      }
    }
  }, [open, isAdmin])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required'
    } else if (formData.title.length > 255) {
      newErrors.title = 'Title must be 255 characters or less'
    }

    if (formData.description && formData.description.length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
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

    try {
      // Clean up the data
      const submitData: CreateWorkOrderRequest = {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        priority: formData.priority as WorkOrderPriority,
        // Convert local date to UTC timestamp with timezone adjustment
        due_date: formData.due_date ? localDateToUTC(formData.due_date) : undefined,
        equipment_id: formData.equipment_id?.trim() || undefined,
        assigned_to: isAdmin && formData.assigned_to?.trim() ? formData.assigned_to.trim() : undefined,
      }

      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create work order')
      }

      const createdWorkOrder = await response.json();

      // Step 2: Upload file if provided (auto-detect photo vs document)
      let fileUploadError: string | null = null
      if (selectedFile && createdWorkOrder?.id) {
        try {
          // Detect file type
          const isPhoto = selectedFile.type.startsWith('image/')
          const endpoint = isPhoto ? '/api/photos' : '/api/documents'
          
          const fileFormData = new FormData()
          fileFormData.append('file', selectedFile)
          fileFormData.append('work_order_id', createdWorkOrder.id)
          
          if (isPhoto) {
            // Photo-specific fields
            fileFormData.append('link_type', 'evidence')
            if (submitData.description) {
              fileFormData.append('description', submitData.description)
            }
          } else {
            // Document-specific fields
            fileFormData.append('title', selectedFile.name)
            fileFormData.append('type', 'other')
            fileFormData.append('scope', 'company')
          }

          const uploadResponse = await fetch(endpoint, {
            method: 'POST',
            body: fileFormData,
          })

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}))
            fileUploadError = errorData.error || `Failed to upload ${isPhoto ? 'photo' : 'document'}`
            console.warn('File upload warning:', fileUploadError)
          }
        } catch (uploadErr) {
          fileUploadError = uploadErr instanceof Error ? uploadErr.message : 'Failed to upload file'
          console.warn('File upload error:', uploadErr)
        }
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        equipment_id: '',
        assigned_to: '',
      })
      setSelectedFile(null)
      setErrors({})

      // Show warning if file upload failed
      if (fileUploadError) {
        setWarning(`Work order created successfully! However, the file upload failed: ${fileUploadError}. You can add files later from the Work Order details.`)
        setTimeout(() => {
          setWarning(null)
          onOpenChange(false)
          onSuccess()
        }, 5000)
      } else {
        // Close dialog and notify parent immediately
        onOpenChange(false)
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (!isSubmitting) {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        equipment_id: '',
        assigned_to: '',
      })
      setSelectedFile(null)
      setErrors({})
      setError(null)
      setWarning(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Work Order"
      description="Fill in the details to create a new work order"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {warning && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">{warning}</p>
          </div>
        )}

          <Input
            label="Title *"
            placeholder="e.g., Replace broken conveyor belt"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            error={errors.title}
            disabled={isSubmitting}
            maxLength={255}
          />

          <Textarea
            label="Description"
            placeholder="Provide additional details about the work order..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            error={errors.description}
            disabled={isSubmitting}
            rows={4}
            maxLength={5000}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Priority"
              options={priorityOptions}
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as WorkOrderPriority })}
              disabled={isSubmitting}
            />

            <Input
              label="Due Date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              disabled={isSubmitting}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <Select
            label="Equipment (Optional)"
            options={[
              { value: '', label: 'None - No equipment' },
              ...equipment.map(eq => ({ 
                value: eq.id, 
                label: `${eq.display_id} - ${eq.name}` 
              }))
            ]}
            value={formData.equipment_id}
            onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
            disabled={isSubmitting || isLoadingEquipment}
          />

          {isAdmin && (
            <Select
              label="Assign To (Optional)"
              options={[
                { value: '', label: 'Unassigned' },
                ...users.map(user => ({ value: user.id, label: user.label }))
              ]}
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              disabled={isSubmitting || isLoadingUsers}
            />
          )}

          {/* File Attachment Section */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Attach File (Optional)</h3>

            <div>
              <label htmlFor="work-order-file" className="block text-sm font-medium text-gray-700 mb-2">
                Photo or Document
              </label>
              <div className="relative">
                <input
                  id="work-order-file"
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  disabled={isSubmitting}
                  className="sr-only"
                  accept="image/*,.pdf,.doc,.docx"
                  aria-label="Upload file (photo or document)"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand hover:bg-brand/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Click to upload file (photo or document)"
                >
                  <Upload className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {selectedFile ? selectedFile.name : 'Click to upload file (photo or document)'}
                  </span>
                </button>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isSubmitting}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full hover:bg-gray-100 transition-colors"
                    title="Remove file"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
            </div>

            {selectedFile && (
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                {selectedFile.type.startsWith('image/') ? ' • Will be uploaded as photo' : ' • Will be uploaded as document'}
              </div>
            )}

            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-md">
              💡 File upload is optional. You can attach photos or documents now, or add them later from the Work Order details page.
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
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
              disabled={isSubmitting}
            >
              Create Work Order
            </Button>
          </div>
        </form>
    </Dialog>
  )
}
