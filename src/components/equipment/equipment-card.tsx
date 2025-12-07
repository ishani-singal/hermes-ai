'use client'

import { Equipment } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EquipmentCardProps {
  equipment: Equipment
  onClick: () => void
}

export function EquipmentCard({ equipment, onClick }: EquipmentCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-3 sm:p-4 cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-brand hover:bg-brand/5',
        'border border-gray-200'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Display ID and Name */}
          <div className="mb-1.5 sm:mb-2">
            <div className="text-xs font-mono text-gray-500 mb-0.5">
              {equipment.display_id}
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {equipment.name}
            </h3>
          </div>

          {/* Equipment Info - Condensed on mobile */}
          <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-3">
            {/* Mobile: Show type and manufacturer on same line */}
            <div className="sm:hidden text-sm text-gray-600">
              {equipment.type && <span>{equipment.type}</span>}
              {equipment.type && equipment.manufacturer && <span> · </span>}
              {equipment.manufacturer && <span>{equipment.manufacturer}</span>}
            </div>
            {/* Desktop: Show each field separately */}
            <div className="hidden sm:block">
              {equipment.type && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Type:</span> {equipment.type}
                </p>
              )}
              {equipment.manufacturer && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Manufacturer:</span> {equipment.manufacturer}
                </p>
              )}
            </div>
            {equipment.model && (
              <p className="text-sm text-gray-600">
                <span className="hidden sm:inline font-medium">Model: </span>
                <span className="sm:hidden">Model: </span>
                {equipment.model}
              </p>
            )}
            {/* Location hidden on mobile */}
            {equipment.location && (
              <p className="hidden sm:block text-sm text-gray-600">
                <span className="font-medium">Location:</span> {equipment.location}
              </p>
            )}
          </div>

          {/* Metadata Tags */}
          {equipment.serial_number && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="info" size="sm">
                SN: {equipment.serial_number}
              </Badge>
            </div>
          )}

          {/* Timestamps - hidden on mobile */}
          <div className="hidden sm:block text-xs text-gray-400 mt-3">
            Created {new Date(equipment.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* Chevron Icon */}
        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
      </div>
    </Card>
  )
}
