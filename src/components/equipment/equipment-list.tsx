'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Equipment, EquipmentListResponse } from '@/types'
import { EquipmentCard } from './equipment-card'
import { EquipmentImportExport } from './equipment-import-export'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

export interface EquipmentListProps {
  onCreateClick: () => void
  onEquipmentClick: (equipment: Equipment) => void
}

export function EquipmentList({ onCreateClick, onEquipmentClick }: EquipmentListProps) {
  const { companies, activeCompanyId } = useAuth()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Check if user can create equipment
  const activeCompany = companies.find(uc => uc.company_id === activeCompanyId)
  const canCreate = activeCompany !== undefined

  const fetchEquipment = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const response = await fetch('/api/equipment')

      if (!response.ok) {
        throw new Error('Failed to fetch equipment')
      }

      const data: EquipmentListResponse = await response.json()
      setEquipment(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchEquipment()
  }, [fetchEquipment])

  const handleRefresh = () => {
    fetchEquipment(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Equipment</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (equipment.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m0 0L4 7m8 4v10l8-4v-10L12 11m0 0L4 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Equipment</h3>
          <p className="text-sm text-gray-500 mb-6">
            Get started by creating your first equipment record or import from CSV.
          </p>
          {canCreate && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={onCreateClick}>
                <Plus className="h-4 w-4 mr-1" />
                Add Equipment
              </Button>
              <EquipmentImportExport 
                onImportSuccess={handleRefresh} 
                hasEquipment={false}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Equipment
          </h2>
          <p className="text-sm text-gray-500">
            {equipment.length} {equipment.length === 1 ? 'equipment' : 'equipment'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            isLoading={isRefreshing}
            title="Refresh equipment list"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {canCreate && (
            <>
              <EquipmentImportExport 
                onImportSuccess={handleRefresh} 
                hasEquipment={equipment.length > 0}
              />
              <Button size="sm" onClick={onCreateClick}>
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">New Equipment</span>
                <span className="sm:hidden">New</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Equipment List */}
      <div className="space-y-2 sm:space-y-4">
        {equipment.map((eq) => (
          <EquipmentCard
            key={eq.id}
            equipment={eq}
            onClick={() => onEquipmentClick(eq)}
          />
        ))}
      </div>
    </div>
  )
}
