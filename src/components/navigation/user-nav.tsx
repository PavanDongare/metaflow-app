'use client'

import { LogOut, User } from 'lucide-react'
import { signout } from '@/app/auth/actions'

interface UserNavProps {
  email: string
}

export function UserNav({ email }: UserNavProps) {
  return (
    <div className="flex items-center gap-4 py-2 px-4 border-b bg-background shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="w-4 h-4" />
        <span>{email}</span>
      </div>
      <form action={signout}>
        <button
          type="submit"
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors border"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </form>
    </div>
  )
}
