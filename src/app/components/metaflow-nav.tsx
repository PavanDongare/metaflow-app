'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeft, PanelRight, Sparkles, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenant } from '@/lib/auth/tenant-context';
import { useObjectTypes, useProjectFlags } from '../lib/hooks/use-ontology';
import { useProcessLayouts } from '../lib/hooks/use-process';
import { useRelationships } from '../lib/hooks/use-relationships';
import { useActionTypes } from '../lib/hooks/use-actions';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/workspace', label: 'Workspace' },
  { href: '/processes', label: 'Processes' },
  { href: '/ontology', label: 'Ontology' },
  { href: '/actions', label: 'Actions' },
  { href: '/generate', label: 'AI Builder', featured: true },
];

type MetaflowNavProps = {
  orientation?: 'horizontal' | 'vertical';
  side?: 'left' | 'right';
  onSideChange?: (side: 'left' | 'right') => void;
};

export function MetaflowNav({
  orientation = 'horizontal',
  side = 'left',
  onSideChange,
}: MetaflowNavProps) {
  const pathname = usePathname();
  const { processFilter, setProcessFilter } = useTenant();
  const isVertical = orientation === 'vertical';

  // Fetch all possible sources of process flags
  const { objectTypes } = useObjectTypes();
  const { layouts } = useProcessLayouts();
  const { relationships } = useRelationships();
  const { actionTypes } = useActionTypes();
  const { flags: snapshotFlags } = useProjectFlags();

  const processFlags = useMemo(() => {
    const rawFlags = new Set<string>();
    
    // Add from all normalized tables
    objectTypes.forEach(t => t.processFlag && rawFlags.add(t.processFlag));
    layouts.forEach(l => l.processFlag && rawFlags.add(l.processFlag));
    relationships.forEach(r => r.processFlag && rawFlags.add(r.processFlag));
    actionTypes.forEach(a => a.processFlag && rawFlags.add(a.processFlag));
    
    // Add from snapshots (Architect blueprints)
    snapshotFlags.forEach(f => rawFlags.add(f));

    // Normalize to handle case sensitivity issues (e.g., "kanban" vs "Kanban")
    const normalized = new Map<string, string>();
    Array.from(rawFlags).forEach(f => {
      const lower = f.toLowerCase();
      // Keep the one that has an uppercase first letter if possible
      if (!normalized.has(lower) || (f[0] === f[0].toUpperCase())) {
        normalized.set(lower, f);
      }
    });

    return Array.from(normalized.values()).sort();
  }, [objectTypes, layouts, relationships, actionTypes, snapshotFlags]);

  return (
    <div
      className={cn(
        'bg-background',
        isVertical ? 'border-r h-full w-56 flex flex-col' : 'border-b'
      )}
    >
      {isVertical && (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">MetaFlow</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant={side === 'left' ? 'secondary' : 'ghost'}
                className="h-7 w-7"
                onClick={() => onSideChange?.('left')}
                title="Dock menu left"
                aria-label="Dock menu left"
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={side === 'right' ? 'secondary' : 'ghost'}
                className="h-7 w-7"
                onClick={() => onSideChange?.('right')}
                title="Dock menu right"
                aria-label="Dock menu right"
              >
                <PanelRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="px-3 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Global Process</span>
            </div>
            <Select value={processFilter} onValueChange={setProcessFilter}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="All Processes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Processes</SelectItem>
                {processFlags.map(flag => (
                  <SelectItem key={flag} value={flag}>{flag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className={cn(isVertical ? 'overflow-y-auto flex-1' : 'overflow-x-auto')}>
        <nav
          className={cn(
            isVertical ? 'flex flex-col py-2' : 'flex gap-0 px-4 min-w-max'
          )}
        >
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  isVertical
                    ? 'mx-2 my-0.5 px-3 py-2 text-sm rounded-md transition-colors'
                    : 'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                  isActive
                    ? isVertical
                      ? 'bg-muted text-foreground'
                      : 'border-primary text-foreground'
                    : isVertical
                      ? 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.featured && <Sparkles className="h-3.5 w-3.5" />}
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
