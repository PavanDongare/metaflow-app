'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function loginAsDemo(redirectTo?: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: 'demo@example.com',
    password: 'demo123456',
  })

  if (error) {
    redirect('/?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo || '/')
}
