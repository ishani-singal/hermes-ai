import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Use a type alias instead of an empty interface to satisfy the linter rule
export type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm',
        className
      )}
      {...props}
    />
  )
}
