import { Button } from '@/components/ui/button'
import { DataHubFile, EquipmentOption, WorkOrderOption } from '../types'
import { ResourceSelectors } from './resource-selectors'

interface FileEditDialogProps {
    open: boolean
    file: DataHubFile | null
    formData: {
        title: string
        description: string
        equipmentId: string
        workOrderId: string
    }
    setFormData: (data: any) => void
    equipment: EquipmentOption[]
    workOrders: WorkOrderOption[]
    loadingEquipment: boolean
    loadingWorkOrders: boolean
    isSaving: boolean
    onCancel: () => void
    onSave: () => void
}

export function FileEditDialog({
    open,
    file,
    formData,
    setFormData,
    equipment,
    workOrders,
    loadingEquipment,
    loadingWorkOrders,
    isSaving,
    onCancel,
    onSave,
}: FileEditDialogProps) {
    if (!open || !file) return null

    const isPhoto = file.file_url.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) || file.type === undefined

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Edit {isPhoto ? 'Photo' : 'Document'}
                </h3>

                {/* Photo Preview (only for photos) */}
                {isPhoto && (
                    <div className="mb-4">
                        <img
                            src={file.file_url}
                            alt={file.description || 'Photo'}
                            className="w-full max-h-64 object-contain rounded bg-gray-100"
                        />
                    </div>
                )}

                {/* Title (only for documents) */}
                {!isPhoto && (
                    <div className="mb-4">
                        <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-2">
                            Title
                        </label>
                        <input
                            id="edit-title"
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            disabled={isSaving}
                        />
                    </div>
                )}

                {/* Equipment and Work Order Selectors */}
                <div className="mb-4">
                    <ResourceSelectors
                        equipmentId={formData.equipmentId}
                        workOrderId={formData.workOrderId}
                        onEquipmentChange={(id) => setFormData({ ...formData, equipmentId: id })}
                        onWorkOrderChange={(id) => setFormData({ ...formData, workOrderId: id })}
                        equipment={equipment}
                        workOrders={workOrders}
                        loadingEquipment={loadingEquipment}
                        loadingWorkOrders={loadingWorkOrders}
                        disabled={isSaving}
                    />
                </div>

                {/* Description (for photos) */}
                {isPhoto && (
                    <div className="mb-4">
                        <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            id="edit-description"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
                            rows={4}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            disabled={isSaving}
                            maxLength={500}
                        />
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onSave}
                        isLoading={isSaving}
                    >
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    )
}
