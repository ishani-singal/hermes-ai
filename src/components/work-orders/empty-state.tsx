'use client'

import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface EmptyStateProps {
  onCreateClick: () => void
  canCreate: boolean
}

export function EmptyState({ onCreateClick, canCreate }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center px-4">
        <ClipboardList className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Work Orders
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Get started by creating your first work order
        </p>
        {canCreate && (
          <Button onClick={onCreateClick}>
            Create Work Order
          </Button>
        )}
        {!canCreate && (
          <p className="text-xs text-gray-400">
            You don&apos;t have permission to create work orders
          </p>
        )}
      </div>
    </div>
  )
}
