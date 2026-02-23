import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  try {
    const { supabaseResponse, user } = await updateSession(request)

    // Protected paths require authentication
    const isProtected = !request.nextUrl.pathname.startsWith('/auth')
    
    // Check if the URL has auth-related parameters (code or token_hash)
    const hasAuthParams = 
      request.nextUrl.searchParams.has('code') || 
      request.nextUrl.searchParams.has('token_hash')

    if (isProtected && !user && !hasAuthParams) {
      const url = new URL('/auth/login', request.url)
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware error:', error)
    // Return the response without auth check on error to prevent 500s
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
