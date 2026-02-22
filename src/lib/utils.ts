import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Gets the base URL for the application dynamically.
 * Works for localhost, Vercel preview deployments, and production.
 */
export function getURL(origin?: string) {
  let url =
    origin ??
    process.env.NEXT_PUBLIC_SITE_URL ?? // Set this in production
    process.env.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel
    'http://localhost:3000'

  // Make sure to include https:// when not localhost
  url = url.startsWith('http') ? url : `https://${url}`
  // Make sure to include trailing /
  url = url.endsWith('/') ? url : `${url}/`
  return url
}

