import { useState } from 'react'
import { DataHubFile, EquipmentOption, WorkOrderOption } from '../types'

interface UseFileEditProps {
    endpoint: string
    onSaveSuccess: () => void
}

export function useFileEdit({ endpoint, onSaveSuccess }: UseFileEditProps) {
    const [editingFile, setEditingFile] = useState<DataHubFile | null>(null)
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Edit form state
    const [editFormData, setEditFormData] = useState({
        title: '', // For documents
        description: '', // For photos
        equipmentId: '',
        workOrderId: '',
    })

    const [equipment, setEquipment] = useState<EquipmentOption[]>([])
    const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([])
    const [loadingEquipment, setLoadingEquipment] = useState(false)
    const [loadingWorkOrders, setLoadingWorkOrders] = useState(false)

    const fetchEquipment = async () => {
        if (equipment.length > 0) return // Don't refetch if already loaded

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
        if (workOrders.length > 0) return // Don't refetch if already loaded

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

    const handleEditClick = (file: DataHubFile, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setEditingFile(file)
        setEditFormData({
            title: file.title || '',
            description: file.description || '',
            equipmentId: file.equipment_id || '',
            workOrderId: file.work_order_id || '',
        })
        setShowEditDialog(true)
        fetchEquipment()
        fetchWorkOrders()
    }

    const handleEditCancel = () => {
        setShowEditDialog(false)
        setEditingFile(null)
        setError(null)
    }

    const handleEditSave = async () => {
        if (!editingFile) return

        try {
            setIsSaving(true)
            setError(null)

            const updates: Record<string, string | null> = {}

            // Handle description (photos)
            if (editFormData.description !== undefined) {
                updates.description = editFormData.description
            }

            // Handle title (documents)
            if (editFormData.title !== undefined && editingFile.title !== undefined) {
                updates.title = editFormData.title
            }

            // Handle equipment link
            if (editFormData.equipmentId !== (editingFile.equipment_id || '')) {
                updates.equipment_id = editFormData.equipmentId || null
            }

            // Handle work order link
            if (editFormData.workOrderId !== (editingFile.work_order_id || '')) {
                updates.work_order_id = editFormData.workOrderId || null
            }

            const response = await fetch(`${endpoint}/${editingFile.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            })

            if (!response.ok) {
                throw new Error('Failed to update file')
            }

            onSaveSuccess()
            setShowEditDialog(false)
            setEditingFile(null)
        } catch (err) {
            console.error('Error updating file:', err)
            setError(err instanceof Error ? err.message : 'Failed to update file')
        } finally {
            setIsSaving(false)
        }
    }

    return {
        editingFile,
        showEditDialog,
        isSaving,
        error,
        editFormData,
        setEditFormData,
        equipment,
        workOrders,
        loadingEquipment,
        loadingWorkOrders,
        handleEditClick,
        handleEditCancel,
        handleEditSave,
    }
}
