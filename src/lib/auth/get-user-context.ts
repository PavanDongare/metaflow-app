import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export type UserContext = {
  userId: string
  email: string
  tenantId: string
  isAdmin: boolean
}

export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get or create profile
  let { data: profile } = await supabase
    .from('user_profiles')
    .select('default_tenant_id, is_admin')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    // Create profile for user (trigger should have done this, but fallback)
    await supabase
      .from('user_profiles')
      .insert({ user_id: user.id })

    profile = {
      default_tenant_id: '00000000-0000-0000-0000-000000000001',
      is_admin: false
    }
  }

  // Admin can override tenant via cookie
  const cookieStore = await cookies()
  const override = cookieStore.get('active_tenant_id')?.value
  const tenantId = profile.is_admin && override
    ? override
    : profile.default_tenant_id

  return {
    userId: user.id,
    email: user.email!,
    tenantId,
    isAdmin: profile.is_admin || false
  }
}
