'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Equipment, UpdateEquipmentRequest } from '@/types'
import { useAuth } from '@/lib/auth/context'
import { Clock } from 'lucide-react'

export interface EquipmentDetailProps {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EquipmentDetail({ equipment, open, onOpenChange, onSuccess }: EquipmentDetailProps) {
  const { companies, activeCompanyId } = useAuth()
  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const isAdmin = activeCompany?.role === 'admin'

  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<UpdateEquipmentRequest>({
    name: '',
    type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    location: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when equipment changes
  useEffect(() => {
    if (equipment) {
      setFormData({
        name: equipment.name,
        type: equipment.type || '',
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        location: equipment.location || '',
      })
      setIsEditing(false)
      setError(null)
    }
  }, [equipment])

  if (!equipment) return null

  const canEdit = activeCompany !== undefined

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name?.trim()) {
      newErrors.name = 'Equipment name is required'
    } else if (formData.name.length > 255) {
      newErrors.name = 'Name must be 255 characters or less'
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
      const updateData: UpdateEquipmentRequest = {}

      // Only include changed fields
      if (formData.name !== equipment.name) updateData.name = formData.name
      if (formData.type !== (equipment.type || '')) updateData.type = formData.type || undefined
      if (formData.manufacturer !== (equipment.manufacturer || '')) updateData.manufacturer = formData.manufacturer || undefined
      if (formData.model !== (equipment.model || '')) updateData.model = formData.model || undefined
      if (formData.serial_number !== (equipment.serial_number || '')) updateData.serial_number = formData.serial_number || undefined
      if (formData.location !== (equipment.location || '')) updateData.location = formData.location || undefined

      // If nothing changed, just exit edit mode
      if (Object.keys(updateData).length === 0) {
        setIsEditing(false)
        return
      }

      const response = await fetch(`/api/equipment/display-id/${equipment.display_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update equipment')
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
    if (equipment) {
      setFormData({
        name: equipment.name,
        type: equipment.type || '',
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        location: equipment.location || '',
      })
    }
    setIsEditing(false)
    setError(null)
  }

  const handleDelete = async () => {
    if (!equipment) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/equipment/display-id/${equipment.display_id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete equipment')
      }

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
      title={isEditing ? 'Edit Equipment' : 'Equipment Details'}
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
              <span className="text-gray-500">Equipment ID:</span>
              <span className="ml-2 font-mono font-semibold text-gray-900">
                {equipment.display_id}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Created: {new Date(equipment.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Updated: {new Date(equipment.updated_at).toLocaleString()}</span>
            </div>
          </div>
        )}

        <Input
          label="Equipment Name *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          disabled={!isEditing}
          maxLength={255}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            disabled={!isEditing}
          />

          <Input
            label="Manufacturer"
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            disabled={!isEditing}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Model"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            disabled={!isEditing}
          />

          <Input
            label="Serial Number"
            value={formData.serial_number}
            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
            disabled={!isEditing}
          />
        </div>

        <Input
          label="Location"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          disabled={!isEditing}
        />

        {/* Action Buttons (when editing) */}
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

      {/* Non-editing action buttons */}
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
            <h4 className="font-semibold text-red-900 mb-2">Delete Equipment?</h4>
            <p className="text-sm text-red-800 mb-1">
              Are you sure you want to delete this equipment record?
            </p>
            <p className="text-sm text-red-700">
              <strong>Display ID:</strong> {equipment.display_id}
            </p>
            <p className="text-sm text-red-700">
              <strong>Name:</strong> {equipment.name}
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
              Delete Equipment
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
