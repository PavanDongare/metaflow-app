import { loginAsDemo } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'

interface DemoButtonProps {
  redirectTo?: string
  className?: string
  children?: React.ReactNode
}

export function DemoButton({ redirectTo = '/', className, children }: DemoButtonProps) {
  const loginWithRedirect = loginAsDemo.bind(null, redirectTo)

  return (
    <form action={loginWithRedirect}>
      <Button variant="outline" size="sm" type="submit" className={className}>
        {children || 'Try Demo →'}
      </Button>
    </form>
  )
}
