import Link from 'next/link'
import { AppInfo } from '@/lib/apps-data'
import { Button } from '@/components/ui/button'
import { DemoButton } from '@/components/demo-button'

interface AppCardProps {
  app: AppInfo
  isLoggedIn: boolean
}

export function AppCard({ app, isLoggedIn }: AppCardProps) {
  return (
    <div className="group border border-border p-6 flex flex-col gap-4 hover:border-foreground transition-colors">
      <Link href={app.href} className="flex items-center gap-3">
        <app.icon className="w-8 h-8 text-foreground" strokeWidth={1.5} />
        <div>
          <h2 className="font-semibold text-foreground">{app.name}</h2>
          <p className="text-sm text-muted-foreground">{app.tagline}</p>
        </div>
      </Link>
      <ul className="text-sm text-muted-foreground space-y-1 flex-1">
        {app.features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>
      {!isLoggedIn ? (
        <DemoButton redirectTo={app.href} className="w-full" />
      ) : (
        <Link href={app.href}>
          <Button variant="outline" size="sm" className="w-full">
            Open →
          </Button>
        </Link>
      )}
    </div>
  )
}
