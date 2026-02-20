import { loginAsDemo } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'

interface DemoButtonProps {
  redirectTo?: string
  className?: string
  children?: React.ReactNode
}

export function DemoButton({ redirectTo = '/apps', className, children }: DemoButtonProps) {
  return (
    <form
      action={async () => {
        'use server'
        await loginAsDemo(redirectTo)
      }}
    >
      <Button variant="outline" size="sm" type="submit" className={className}>
        {children || 'Try Demo →'}
      </Button>
    </form>
  )
}
