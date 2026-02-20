'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeft, PanelRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/generate', label: 'AI Builder', featured: true },
  { href: '/ontology', label: 'Ontology' },
  { href: '/workspace', label: 'Workspace' },
  { href: '/actions', label: 'Actions' },
  { href: '/processes', label: 'Processes' },
  { href: '/dashboard', label: 'Dashboard' },
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
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'bg-background',
        isVertical ? 'border-r h-full w-56 flex flex-col' : 'border-b'
      )}
    >
      {isVertical && (
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
      )}

      <div className={cn(isVertical ? 'overflow-y-auto' : 'overflow-x-auto')}>
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
                  item.featured && isVertical && 'bg-primary/10 text-primary border border-primary/20',
                  item.featured && !isVertical && 'text-primary',
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
