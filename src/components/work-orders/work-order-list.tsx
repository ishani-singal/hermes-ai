'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { WorkOrder, WorkOrderListResponse } from '@/types'
import { WorkOrderCard } from './work-order-card'
import { EmptyState } from './empty-state'
import { WorkOrderListSkeleton } from './work-order-list-skeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

export interface WorkOrderListProps {
  onCreateClick: () => void
  onWorkOrderClick: (workOrder: WorkOrder) => void
}

export function WorkOrderList({ onCreateClick, onWorkOrderClick }: WorkOrderListProps) {
  const { user, companies, activeCompanyId } = useAuth()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Check if user can create work orders
  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const canCreate = activeCompany !== undefined // Both admin and user can create

  const fetchWorkOrders = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const response = await fetch('/api/work-orders')
      
      if (!response.ok) {
        throw new Error('Failed to fetch work orders')
      }

      const data: WorkOrderListResponse = await response.json()
      setWorkOrders(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchWorkOrders()
  }, [fetchWorkOrders])

  const handleRefresh = () => {
    fetchWorkOrders(true)
  }

  if (isLoading) {
    return <WorkOrderListSkeleton />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center px-4">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Work Orders</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (workOrders.length === 0) {
    return <EmptyState onCreateClick={onCreateClick} canCreate={canCreate} />
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Work Orders
          </h2>
          <p className="text-sm text-gray-500">
            {workOrders.length} {workOrders.length === 1 ? 'work order' : 'work orders'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            isLoading={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {canCreate && (
            <Button size="sm" onClick={onCreateClick}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">New Work Order</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      {/* Work Order List */}
      <div className="space-y-4">
        {workOrders.map((workOrder) => (
          <WorkOrderCard
            key={workOrder.id}
            workOrder={workOrder}
            onClick={() => onWorkOrderClick(workOrder)}
          />
        ))}
      </div>
    </div>
  )
}
