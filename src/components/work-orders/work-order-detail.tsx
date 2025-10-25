'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { WorkOrder, WorkOrderStatus, WorkOrderPriority, UpdateWorkOrderRequest } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { Clock } from 'lucide-react'

export interface WorkOrderDetailProps {
  workOrder: WorkOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export function WorkOrderDetail({ workOrder, open, onOpenChange, onSuccess }: WorkOrderDetailProps) {
  const { companies, activeCompanyId } = useAuth()
  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const isAdmin = activeCompany?.role === 'admin'

  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Initialize with defaults so inputs are controlled from first render
  const [formData, setFormData] = useState<UpdateWorkOrderRequest>({
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    due_date: '',
    equipment_id: '',
    assigned_to: '',
  })

  // Reset form when work order changes
  useEffect(() => {
    if (workOrder) {
      setFormData({
        title: workOrder.title,
        description: workOrder.description || '',
        status: workOrder.status,
        priority: workOrder.priority,
        due_date: workOrder.due_date || '',
        equipment_id: workOrder.equipment_id || '',
        assigned_to: workOrder.assigned_to || '',
      })
      setIsEditing(false)
      setError(null)
    }
  }, [workOrder])

  if (!workOrder) return null

  // Both admin and regular users (editor/viewer) can view and edit work orders
  const canEdit = activeCompany !== undefined
  
  // Admin can edit all fields, others can only edit description and status
  const canEditField = (field: string): boolean => {
    if (isAdmin) return true
    return field === 'description' || field === 'status'
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    setIsSubmitting(true)
    setError(null)

    try {
      // Build update payload based on permissions
      const updateData: UpdateWorkOrderRequest = {}
      
      if (canEditField('title') && formData.title !== workOrder.title) {
        updateData.title = formData.title
      }
      if (canEditField('description') && formData.description !== workOrder.description) {
        updateData.description = formData.description
      }
      if (canEditField('status') && formData.status !== workOrder.status) {
        updateData.status = formData.status
      }
      if (canEditField('priority') && formData.priority !== workOrder.priority) {
        updateData.priority = formData.priority
      }
      if (canEditField('due_date') && formData.due_date !== workOrder.due_date) {
        updateData.due_date = formData.due_date || undefined
      }
      if (canEditField('equipment_id') && formData.equipment_id !== workOrder.equipment_id) {
        updateData.equipment_id = formData.equipment_id || undefined
      }
      if (canEditField('assigned_to') && formData.assigned_to !== workOrder.assigned_to) {
        updateData.assigned_to = formData.assigned_to || undefined
      }

      // If nothing changed, just exit edit mode
      if (Object.keys(updateData).length === 0) {
        setIsEditing(false)
        return
      }

      const response = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update work order')
      }

      setIsEditing(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (workOrder) {
      setFormData({
        title: workOrder.title,
        description: workOrder.description || '',
        status: workOrder.status,
        priority: workOrder.priority,
        due_date: workOrder.due_date || '',
        equipment_id: workOrder.equipment_id || '',
        assigned_to: workOrder.assigned_to || '',
      })
    }
    setIsEditing(false)
    setError(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Work Order' : 'Work Order Details'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Read-only metadata */}
        {!isEditing && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Created: {new Date(workOrder.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Updated: {new Date(workOrder.updated_at).toLocaleString()}</span>
            </div>
            {workOrder.completed_at && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Completed: {new Date(workOrder.completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        <Input
          label="Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          disabled={!isEditing || !canEditField('title')}
          maxLength={255}
        />

        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          disabled={!isEditing || !canEditField('description')}
          rows={4}
          maxLength={5000}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Status"
            options={statusOptions}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as WorkOrderStatus })}
            disabled={!isEditing || !canEditField('status')}
          />

          <Select
            label="Priority"
            options={priorityOptions}
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value as WorkOrderPriority })}
            disabled={!isEditing || !canEditField('priority')}
          />
        </div>

        <Input
          label="Due Date"
          type="date"
          value={formData.due_date}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          disabled={!isEditing || !canEditField('due_date')}
        />

        <Input
          label="Equipment ID"
          value={formData.equipment_id}
          onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
          disabled={!isEditing || !canEditField('equipment_id')}
        />

        {isAdmin && (
          <Input
            label="Assigned To (User ID)"
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            disabled={!isEditing || !canEditField('assigned_to')}
          />
        )}

        {/* Permission notice for users */}
        {!isAdmin && isEditing && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-800">
              ℹ️ As a user, you can only edit the description and status fields. 
              Contact an admin to modify other fields.
            </p>
          </div>
        )}

        {/* Action Buttons (when editing: submit buttons stay inside the form) */}
        {isEditing && (
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
              Save Changes
            </Button>
          </div>
        )}
      </form>

      {/* Non-editing action buttons (moved outside the form to avoid accidental submits) */}
      {!isEditing && (
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {canEdit && (
            <Button
              type="button"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>
      )}
    </Dialog>
  )
}
