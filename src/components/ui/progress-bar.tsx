export function ProgressBar({ progress }: { progress: number }) {
  // Map progress percentage to Tailwind width classes
  // This is a workaround since dynamic widths require inline styles
  const getWidthClass = (p: number): string => {
    if (p === 0) return 'w-0'
    if (p <= 10) return 'w-[10%]'
    if (p <= 20) return 'w-[20%]'
    if (p <= 30) return 'w-[30%]'
    if (p <= 40) return 'w-[40%]'
    if (p <= 50) return 'w-1/2'
    if (p <= 60) return 'w-[60%]'
    if (p <= 70) return 'w-[70%]'
    if (p <= 80) return 'w-[80%]'
    if (p <= 90) return 'w-[90%]'
    return 'w-full'
  }

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className={`${getWidthClass(progress)} bg-brand h-2 rounded-full transition-all duration-300`}
      />
    </div>
  )
}
