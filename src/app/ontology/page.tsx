'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Settings, Database, ArrowRight, Loader2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useObjectTypes } from '../lib/hooks';
import { useTenant } from '@/lib/auth/tenant-context';

export default function OntologyPage() {
  const { processFilter } = useTenant();
  const { objectTypes, loading, error, refetch } = useObjectTypes();

  // Filtered data
  const filteredTypes = useMemo(() => 
    processFilter === 'all' ? objectTypes : objectTypes.filter(t => t.processFlag === processFilter),
    [objectTypes, processFilter]
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
        <Button onClick={refetch} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Object Types</h1>
          <p className="text-muted-foreground">
            Define and manage your data schema
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {processFilter !== 'all' && (
            <Badge variant="outline" className="px-3 py-1 h-auto text-sm font-bold border-primary/30 text-primary mr-2 uppercase">
              {processFilter}
            </Badge>
          )}
          
          <Link href="/ontology/relationships">
            <Button variant="outline">
              <ArrowRight className="w-4 h-4 mr-2" />
              Relationships
            </Button>
          </Link>
          <Link href="/ontology/visualization">
            <Button variant="outline">
              <Database className="w-4 h-4 mr-2" />
              Visualization
            </Button>
          </Link>
          <Link href="/ontology/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Object Type
            </Button>
          </Link>
        </div>
      </div>

      {/* Object Types List */}
      {filteredTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {processFilter === 'all' ? 'No Object Types' : `No Object Types in ${processFilter}`}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {processFilter === 'all' 
                ? 'Get started by creating your first object type' 
                : `No object types are currently flagged as ${processFilter}`}
            </p>
            {processFilter === 'all' && (
              <Link href="/ontology/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Object Type
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y bg-card">
          {filteredTypes
            .slice()
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map((type) => {
              const props = Object.values(type.config.properties || {});
              const propertyCount = props.length;
              const requiredCount = props.filter((p) => p.required).length;
              const referenceCount = props.filter((p) => p.type === 'object-reference').length;
              const picklistCount = props.filter((p) => p.picklistConfig).length;

              return (
                <div
                  key={type.id}
                  className="px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{type.displayName}</p>
                        {type.processFlag && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase">
                            {type.processFlag}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {propertyCount} properties, {requiredCount} required, {referenceCount} references, {picklistCount} picklists
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                        {type.id}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/ontology/${type.id}`}>
                        <Button variant="ghost" size="icon" title="Configure object type">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Link href={`/ontology/${type.id}/data`}>
                        <Button variant="outline" size="sm">
                          Data
                        </Button>
                      </Link>
                      <Link href={`/workspace/${type.id}`}>
                        <Button variant="outline" size="sm">
                          Workspace
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
