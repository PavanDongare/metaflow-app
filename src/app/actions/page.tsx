'use client';

import Link from 'next/link';
import { Loader2, Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useActionTypes } from '../lib/hooks';

export default function ActionsPage() {
  const { actionTypes, loading, error } = useActionTypes();

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
          <p className="text-muted-foreground">
            {actionTypes.length} action{actionTypes.length !== 1 ? 's' : ''} defined
          </p>
        </div>
        <Link href="/actions/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Action
          </Button>
        </Link>
      </div>

      {actionTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Actions</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first action to automate workflows
            </p>
            <Link href="/actions/new">
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create Action
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y bg-card">
          {actionTypes
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
                      <p className="font-medium">{action.displayName}</p>
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
