'use client';

import Link from 'next/link';
import { Database, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useObjectTypes } from '../lib/hooks';

export default function WorkspacePage() {
  const { objectTypes, loading, error } = useObjectTypes();

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

  // Filter out junction object types
  const regularTypes = objectTypes.filter(t => !t.config.isJunction);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workspace</h1>
        <p className="text-muted-foreground">
          Manage your data instances
        </p>
      </div>

      {regularTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Object Types</h3>
            <p className="text-muted-foreground text-center">
              Create object types in the Ontology section first
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
                      <p className="font-medium">{type.displayName}</p>
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
