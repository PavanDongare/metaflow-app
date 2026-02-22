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
    origin && origin.trim() !== ''
      ? origin
      : process.env.NEXT_PUBLIC_SITE_URL ??
        process.env.NEXT_PUBLIC_VERCEL_URL ??
        'http://localhost:3000'

  // Make sure to include http(s)://
  url = url.startsWith('http') ? url : `https://${url}`
  // Make sure to include trailing /
  url = url.endsWith('/') ? url : `${url}/`
  return url
}

