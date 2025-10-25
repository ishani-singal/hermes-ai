'use client'

import { useState, FormEvent } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CreateWorkOrderRequest, WorkOrderPriority } from '@/types'
import { useAuth } from '@/lib/auth/context'

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

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateWorkOrderRequest>({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    equipment_id: '',
    assigned_to: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

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
        due_date: formData.due_date || undefined,
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

      // Reset form
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        equipment_id: '',
        assigned_to: '',
      })
      setErrors({})
      
      // Close dialog and notify parent
      onOpenChange(false)
      onSuccess()
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
      setErrors({})
      setError(null)
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

        <Input
          label="Equipment ID"
          placeholder="Optional: Equipment identifier"
          value={formData.equipment_id}
          onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
          disabled={isSubmitting}
        />

        {isAdmin && (
          <Input
            label="Assign To (User ID)"
            placeholder="Optional: User ID to assign this work order"
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            disabled={isSubmitting}
          />
        )}

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
