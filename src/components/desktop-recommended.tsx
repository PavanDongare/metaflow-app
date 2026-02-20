'use client'

import { Monitor } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

interface DesktopRecommendedProps {
  children: React.ReactNode
  featureName?: string
}

export function DesktopRecommended({
  children,
  featureName = 'This feature',
}: DesktopRecommendedProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-zinc-50 dark:bg-zinc-900">
        <Monitor className="w-16 h-16 text-zinc-400 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Best viewed on desktop</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
          {featureName} works best on larger screens. Please use a desktop or
          tablet for the full experience.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
