import Link from 'next/link'

export default function MetaflowGeneratePage() {
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Prominent Feature</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">AI Builder</h1>
          <div className="mt-3 rounded-md border border-yellow-300 bg-yellow-50/80 p-3 text-sm text-yellow-900">
            AI Builder is an upcoming feature. It is not fully ready yet, so some flows are still in progress.
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Describe your process app in plain English and iteratively refine the generated config
            until you are happy, then validate and apply.
          </p>
          <div className="mt-4">
            <Link
              href="/processes"
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open Processes
            </Link>
          </div>
        </div>

        <div className="rounded-xl border p-6">
          <h2 className="text-base font-medium">What This Will Do</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Generate a draft config from your prompt</li>
            <li>Let you continue chatting to improve only what you want</li>
            <li>Run validation checks before final apply</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
