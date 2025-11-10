'use client'

import { WorkOrder, WorkOrderPriority, WorkOrderStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Calendar, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WorkOrderCardProps {
  workOrder: WorkOrder
  onClick?: () => void
}

const statusVariants: Record<WorkOrderStatus, 'default' | 'info' | 'success' | 'danger' | 'warning'> = {
  open: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'default',
}

const priorityVariants: Record<WorkOrderPriority, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
}

export function WorkOrderCard({ workOrder, onClick }: WorkOrderCardProps) {
  const isOverdue = workOrder.due_date && 
    new Date(workOrder.due_date) < new Date() && 
    workOrder.status !== 'completed' && 
    workOrder.status !== 'cancelled'

  return (
    <Card 
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-md',
        'focus-within:ring-2 focus-within:ring-brand',
        onClick && 'active:scale-[0.99]'
      )}
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 line-clamp-2">
              {workOrder.title}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {workOrder.display_id}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Badge variant={priorityVariants[workOrder.priority]}>
              {workOrder.priority}
            </Badge>
            <Badge variant={statusVariants[workOrder.status]}>
              {workOrder.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Description */}
        {workOrder.description && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {workOrder.description}
          </p>
        )}

        {/* Meta Information */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          {workOrder.assigned_to && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>
                {workOrder.assigned_to_user?.full_name || 'Assigned'}
              </span>
            </div>
          )}
          
          {workOrder.due_date && (
            <div className={cn(
              'flex items-center gap-1',
              isOverdue && 'text-red-600 font-medium'
            )}>
              <Calendar className="h-3 w-3" />
              <span>
                Due {new Date(workOrder.due_date).toLocaleDateString()}
              </span>
              {isOverdue && <span className="ml-1">(Overdue)</span>}
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              Created {new Date(workOrder.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
