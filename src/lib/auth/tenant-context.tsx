'use client'

import { createContext, useContext, useState } from 'react'

type TenantContextValue = {
  userId: string
  tenantId: string
  isAdmin: boolean
  processFilter: string
  setProcessFilter: (filter: string) => void
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({
  children,
  value
}: {
  children: React.ReactNode
  value: Omit<TenantContextValue, 'processFilter' | 'setProcessFilter'>
}) {
  const [processFilter, setProcessFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    return window.localStorage.getItem('metaflow.process.filter') || 'all';
  });

  const handleSetFilter = (filter: string) => {
    setProcessFilter(filter);
    window.localStorage.setItem('metaflow.process.filter', filter);
  };

  return (
    <TenantContext.Provider value={{ ...value, processFilter, setProcessFilter: handleSetFilter }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return ctx
}
