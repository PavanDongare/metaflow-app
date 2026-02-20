import { FileText, PenTool, Network, LucideIcon } from 'lucide-react'

export interface AppInfo {
  name: string
  tagline: string
  icon: LucideIcon
  href: string
  features: string[]
}

export const apps: AppInfo[] = [
  {
    name: 'Documents',
    tagline: 'Smart document management',
    icon: FileText,
    href: '/dms',
    features: [
      'Claude-powered metadata extraction',
      'Conversational search with tool use',
      'Auto-classification into sections',
    ],
  },
  {
    name: 'Notes',
    tagline: 'Flexible note-taking',
    icon: PenTool,
    href: '/onenote',
    features: [
      'Notebooks → Sections → Pages hierarchy',
      'Infinite canvas editor (tldraw)',
      'Zustand-powered state management',
    ],
  },
  {
    name: 'Metaflow',
    tagline: 'Low-code data platform',
    icon: Network,
    href: '/',
    features: [
      'Visual ontology graph (ReactFlow)',
      'Runtime-defined schemas via JSONB',
      'Declarative actions & workflows',
    ],
  },
]
