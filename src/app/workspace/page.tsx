'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Database, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useObjectTypes } from '../lib/hooks';
import { useTenant } from '@/lib/auth/tenant-context';

export default function WorkspacePage() {
  const { processFilter } = useTenant();
  const { objectTypes, loading, error } = useObjectTypes();

  // Filter out junction object types and apply process filter
  const regularTypes = useMemo(() => {
    let types = objectTypes.filter(t => !t.config.isJunction);
    if (processFilter !== 'all') {
      types = types.filter(t => t.processFlag === processFilter);
    }
    return types;
  }, [objectTypes, processFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspace</h1>
          <p className="text-muted-foreground">
            Manage your data instances
          </p>
        </div>
        {processFilter !== 'all' && (
          <Badge variant="outline" className="px-3 py-1 h-auto text-sm font-bold border-primary/30 text-primary uppercase">
            {processFilter}
          </Badge>
        )}
      </div>

      {regularTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {processFilter === 'all' ? 'No Object Types' : `No Object Types in ${processFilter}`}
            </h3>
            <p className="text-muted-foreground text-center">
              {processFilter === 'all' 
                ? 'Create object types in the Ontology section first'
                : `No object types are currently flagged as ${processFilter}`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y bg-card">
          {regularTypes
            .slice()
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map((type) => {
              const props = Object.keys(type.config.properties || {});
              const statusProps = Object.entries(type.config.properties || {}).filter(
                ([, p]) => p.type === 'string' && !!p.picklistConfig
              );

              return (
                <Link
                  key={type.id}
                  href={`/workspace/${type.id}`}
                  className="block px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{type.displayName}</p>
                        {type.processFlag && processFilter === 'all' && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase">
                            {type.processFlag}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {props.length} properties
                        {type.config.titleKey ? `, title: ${type.config.titleKey}` : ''}
                        {statusProps.length ? `, pipeline-ready` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {statusProps.length
                          ? `State field${statusProps.length > 1 ? 's' : ''}: ${statusProps
                              .map(([k]) => k)
                              .join(', ')}`
                          : 'No state picklist fields'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      Open
                    </span>
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
