'use client'

import { createContext, useContext } from 'react'

type TenantContextValue = {
  userId: string
  tenantId: string
  isAdmin: boolean
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({
  children,
  value
}: {
  children: React.ReactNode
  value: TenantContextValue
}) {
  return (
    <TenantContext.Provider value={value}>
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
