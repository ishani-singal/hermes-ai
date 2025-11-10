'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { WorkOrder, WorkOrderStatus, WorkOrderPriority, UpdateWorkOrderRequest } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { localDateToUTC, utcToLocalDateString } from '@/lib/utils/date-timezone'
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
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  
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

  // Fetch users when component mounts (for the dropdown)
  useEffect(() => {
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

    if (isAdmin) {
      fetchUsers()
    }
  }, [isAdmin])

  // Reset form when work order changes
  useEffect(() => {
    if (workOrder) {
      setFormData({
        title: workOrder.title,
        description: workOrder.description || '',
        status: workOrder.status,
        priority: workOrder.priority,
        // Convert UTC timestamp back to local date string for the input
        due_date: workOrder.due_date ? utcToLocalDateString(workOrder.due_date) : '',
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
        // Convert local date to ISO string with timezone adjustment
        if (formData.due_date) {
          updateData.due_date = localDateToUTC(formData.due_date)
        } else {
          updateData.due_date = undefined
        }
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

      const response = await fetch(`/api/work-orders/display-id/${workOrder.display_id}`, {
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
        // Convert UTC timestamp back to local date string for the input
        due_date: workOrder.due_date ? utcToLocalDateString(workOrder.due_date) : '',
        equipment_id: workOrder.equipment_id || '',
        assigned_to: workOrder.assigned_to || '',
      })
    }
    setIsEditing(false)
    setError(null)
  }

  const handleDelete = async () => {
    if (!workOrder) return
    
    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/work-orders/display-id/${workOrder.display_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete work order')
      }

      // Close the dialog and notify success
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
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
            <div className="text-sm">
              <span className="text-gray-500">Work Order ID:</span>
              <span className="ml-2 font-mono font-semibold text-gray-900">
                {workOrder.display_id}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Created: {new Date(workOrder.created_at).toLocaleString()}</span>
              {workOrder.created_by_user && (
                <span className="text-gray-500">
                  by {workOrder.created_by_user.full_name}
                </span>
              )}
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
            {workOrder.assigned_to_user && (
              <div className="text-sm">
                <span className="text-gray-500">Assigned to:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {workOrder.assigned_to_user.full_name}
                </span>
                <span className="ml-1 text-gray-500">
                  ({workOrder.assigned_to_user.email})
                </span>
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
          <div>
            {isEditing ? (
              <Select
                label="Assigned To"
                options={[
                  { value: '', label: 'Unassigned' },
                  ...users.map(user => ({ value: user.id, label: user.label }))
                ]}
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                disabled={!isEditing || !canEditField('assigned_to') || isLoadingUsers}
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned To
                </label>
                <div className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900">
                  {workOrder.assigned_to_user ? (
                    <>
                      <span className="font-medium">{workOrder.assigned_to_user.full_name}</span>
                      <span className="text-gray-500 ml-1">({workOrder.assigned_to_user.email})</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Permission notice for users */}
        {!isAdmin && isEditing && (
          <div className="p-3 bg-brand/10 border border-brand rounded-md">
            <p className="text-xs text-brand-dark">
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
      {!isEditing && !showDeleteConfirm && (
        <div className="flex gap-3 justify-between pt-4 border-t border-gray-200">
          <div>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 hover:text-red-700 hover:border-red-300"
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-3">
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
        </div>
      )}

      {/* Delete Confirmation */}
      {!isEditing && showDeleteConfirm && (
        <div className="pt-4 border-t border-gray-200">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
            <h4 className="font-semibold text-red-900 mb-2">Delete Work Order?</h4>
            <p className="text-sm text-red-800 mb-1">
              Are you sure you want to delete this work order?
            </p>
            <p className="text-sm text-red-700">
              <strong>Display ID:</strong> {workOrder.display_id}
            </p>
            <p className="text-sm text-red-700">
              <strong>Title:</strong> {workOrder.title}
            </p>
            <p className="text-sm text-red-800 mt-2 font-medium">
              This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false)
                setError(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              isLoading={isDeleting}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Work Order
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
