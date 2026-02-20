import { getUserContext } from '@/lib/auth/get-user-context'
import { TenantProvider } from '@/lib/auth/tenant-context'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode
}) {
  const ctx = await getUserContext()

  if (!ctx) {
    redirect('/auth/login')
  }

  return (
    <TenantProvider value={{
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      isAdmin: ctx.isAdmin
    }}>
      {children}
    </TenantProvider>
  )
}
