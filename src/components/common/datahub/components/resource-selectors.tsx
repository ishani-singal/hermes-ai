import { EquipmentOption, WorkOrderOption } from '../types'

interface ResourceSelectorsProps {
    equipmentId: string
    workOrderId: string
    onEquipmentChange: (id: string) => void
    onWorkOrderChange: (id: string) => void
    equipment: EquipmentOption[]
    workOrders: WorkOrderOption[]
    loadingEquipment: boolean
    loadingWorkOrders: boolean
    disabled?: boolean
    equipmentError?: string
    showEquipment?: boolean
    showWorkOrder?: boolean
}

export function ResourceSelectors({
    equipmentId,
    workOrderId,
    onEquipmentChange,
    onWorkOrderChange,
    equipment,
    workOrders,
    loadingEquipment,
    loadingWorkOrders,
    disabled = false,
    equipmentError,
    showEquipment = true,
    showWorkOrder = true,
}: ResourceSelectorsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {showEquipment && (
                <div>
                    <label htmlFor="resource-equipment" className="block text-sm font-medium text-gray-700 mb-1">
                        Link to Equipment
                    </label>
                    <select
                        id="resource-equipment"
                        value={equipmentId}
                        onChange={(e) => onEquipmentChange(e.target.value)}
                        disabled={disabled || loadingEquipment}
                        className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent ${equipmentError ? 'border-red-300' : 'border-gray-300'
                            }`}
                    >
                        <option value="">No equipment</option>
                        {equipment.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                                {eq.display_id} - {eq.name}
                            </option>
                        ))}
                    </select>
                    {equipmentError && (
                        <p className="mt-1 text-sm text-red-600">{equipmentError}</p>
                    )}
                    {loadingEquipment && (
                        <p className="mt-1 text-xs text-gray-500">Loading equipment...</p>
                    )}
                </div>
            )}

            {showWorkOrder && (
                <div>
                    <label htmlFor="resource-work-order" className="block text-sm font-medium text-gray-700 mb-1">
                        Link to Work Order
                    </label>
                    <select
                        id="resource-work-order"
                        value={workOrderId}
                        onChange={(e) => onWorkOrderChange(e.target.value)}
                        disabled={disabled || loadingWorkOrders}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                    >
                        <option value="">No work order</option>
                        {workOrders.map((wo) => (
                            <option key={wo.id} value={wo.id}>
                                {wo.display_id} - {wo.title}
                            </option>
                        ))}
                    </select>
                    {loadingWorkOrders && (
                        <p className="mt-1 text-xs text-gray-500">Loading work orders...</p>
                    )}
                </div>
            )}
        </div>
    )
}
