'use client'

export function WorkOrderListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div 
          key={i} 
          className="p-4 rounded-lg border border-gray-200 bg-white animate-pulse"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="h-5 bg-gray-200 rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
              <div className="h-5 w-20 bg-gray-200 rounded-full" />
            </div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
          <div className="flex gap-4">
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-28 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
