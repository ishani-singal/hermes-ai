'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Tab {
  id: string
  label: string
  icon?: ReactNode
}

export interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <nav className={cn('flex -mb-px space-x-6 sm:space-x-10 px-4', className)} aria-label="Tabs">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm sm:text-base whitespace-nowrap',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-t',
              isActive
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
