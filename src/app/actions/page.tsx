'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Loader2, Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useActionTypes } from '../lib/hooks';
import { useTenant } from '@/lib/auth/tenant-context';

export default function ActionsPage() {
  const { processFilter } = useTenant();
  const { actionTypes, loading, error } = useActionTypes();

  // Filtered data
  const filteredActions = useMemo(() => 
    processFilter === 'all' ? actionTypes : actionTypes.filter(a => a.processFlag === processFilter),
    [actionTypes, processFilter]
  );

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
          <h1 className="text-2xl font-bold">Actions</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">
              {filteredActions.length} action{filteredActions.length !== 1 ? 's' : ''} defined
            </p>
            {processFilter !== 'all' && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold border-primary/30 text-primary uppercase">
                {processFilter}
              </Badge>
            )}
          </div>
        </div>
        <Link href="/actions/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Action
          </Button>
        </Link>
      </div>

      {filteredActions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {processFilter === 'all' ? 'No Actions' : `No Actions in ${processFilter}`}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {processFilter === 'all' 
                ? 'Create your first action to automate workflows'
                : `No actions are currently flagged as ${processFilter}`}
            </p>
            {processFilter === 'all' && (
              <Link href="/actions/new">
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Action
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y bg-card">
          {filteredActions
            .slice()
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map((action) => {
              const paramCount = action.config.parameters?.length || 0;
              const ruleCount = action.config.rules?.length || 0;
              const hasCriteria = (action.config.submissionCriteria?.length || 0) > 0;

              return (
                <Link
                  key={action.id}
                  href={`/actions/${action.id}`}
                  className="block px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{action.displayName}</p>
                        {action.processFlag && processFilter === 'all' && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase">
                            {action.processFlag}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {action.config.executionType === 'declarative' ? 'Declarative' : 'Function-backed'} • {paramCount} params • {ruleCount} rules • {hasCriteria ? 'has criteria' : 'no criteria'}
                      </p>
                      {action.config.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {action.config.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">Open</span>
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
