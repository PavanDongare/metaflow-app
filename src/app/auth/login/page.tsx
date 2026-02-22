import Link from 'next/link'
import { signIn } from '../actions'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OriginInput } from '@/components/auth/origin-input'
import { DemoButton } from '@/components/demo-button'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-2">
        <section className="order-2 flex items-center px-6 py-10 lg:order-1 lg:px-12">
          <div className="w-full max-w-xl space-y-6">
            <p className="inline-flex rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              Metaflow
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Model complex work as clear processes.
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Metaflow lets teams define ontology, automate transitions, and operate workflows with full visibility.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Ontology-driven process modeling</li>
              <li>Action and state tracking across flows</li>
              <li>Workspace tools for operational execution</li>
            </ul>
          </div>
        </section>

        <section className="order-1 flex items-center justify-center px-4 py-8 lg:order-2 lg:px-8">
          <Card className="w-full max-w-md shadow-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>Enter your email to receive a magic link</CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {message && (
                <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                  {message}
                </div>
              )}

              <form className="space-y-4">
                <OriginInput />
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <Button formAction={signIn} className="w-full">
                  Send Magic Link
                </Button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <DemoButton redirectTo="/" className="w-full">
                Try Demo Account
              </DemoButton>
            </CardContent>

            <CardFooter className="justify-center">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/auth/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </Card>
        </section>
      </div>
    </div>
  )
}
