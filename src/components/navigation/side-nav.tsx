'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface NavItem {
  id: string
  label: string
  icon: ReactNode
}

export interface SideNavProps {
  items: NavItem[]
  activeItem: string
  onItemChange: (itemId: string) => void
  className?: string
}

/**
 * Responsive Side Navigation Component
 * - Desktop/Tablet (md+): Side nav on the left
 * - Mobile: Fixed bottom navigation bar (like mobile apps)
 */
export function SideNav({ items, activeItem, onItemChange, className }: SideNavProps) {
  const handleItemClick = (itemId: string) => {
    onItemChange(itemId)
  }

  return (
    <>
      {/* Desktop Side Navigation - visible md+ */}
      <nav
        className={cn(
          'hidden md:block',
          'bg-white border-r border-brand/20',
          'w-64 flex-shrink-0',
          className
        )}
        aria-label="Main navigation"
      >
        {/* Desktop Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-brand/20">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Navigation
          </span>
        </div>

        {/* Navigation Items - Vertical */}
        <div className="flex flex-col">
          {items.map((item) => {
            const isActive = activeItem === item.id

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  'flex items-center gap-3',
                  'px-4 py-3',
                  'text-sm font-medium',
                  'border-l-4',
                  'transition-colors duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                  isActive
                    ? 'border-brand text-brand bg-brand/5'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="h-5 w-5 flex-shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation - visible below md */}
      <nav
        className={cn(
          'md:hidden',
          'fixed bottom-0 left-0 right-0 z-40',
          'bg-white border-t border-brand/20',
          'shadow-lg',
          className
        )}
        aria-label="Main navigation"
      >
        {/* Navigation Items - Horizontal */}
        <div className="flex justify-around items-center h-16 px-2">
          {items.map((item) => {
            const isActive = activeItem === item.id

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1',
                  'flex-1 h-full',
                  'text-xs font-medium',
                  'transition-colors duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                  isActive
                    ? 'text-brand'
                    : 'text-gray-600'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={cn(
                  'h-6 w-6 flex-shrink-0',
                  isActive && 'scale-110'
                )}>{item.icon}</span>
                <span className="truncate max-w-[60px]">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
