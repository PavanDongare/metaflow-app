'use client';

import { Database, Loader2, ArrowRight, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useObjectTypes } from '../lib/hooks';
import { useRelationships } from '../lib/hooks/use-relationships';
import { useActionTypes } from '../lib/hooks/use-actions';

export default function DashboardPage() {
  const { objectTypes, loading: typesLoading } = useObjectTypes();
  const { relationships, loading: relsLoading } = useRelationships();
  const { actionTypes, loading: actionsLoading } = useActionTypes();

  const loading = typesLoading || relsLoading || actionsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    {
      title: 'Object Types',
      value: objectTypes.length,
      icon: Database,
      description: 'Schema definitions',
    },
    {
      title: 'Relationships',
      value: relationships.length,
      icon: ArrowRight,
      description: 'Type connections',
    },
    {
      title: 'Actions',
      value: actionTypes.length,
      icon: Zap,
      description: 'Automated workflows',
    },
  ];

  // Count total properties
  const totalProperties = objectTypes.reduce(
    (sum, type) => sum + Object.keys(type.config.properties || {}).length,
    0
  );

  const topTypes = objectTypes
    .map((type) => ({
      id: type.id,
      name: type.displayName,
      propertyCount: Object.keys(type.config.properties || {}).length,
      picklistCount: Object.values(type.config.properties || {}).filter((p) => !!p.picklistConfig).length,
    }))
    .sort((a, b) => b.propertyCount - a.propertyCount)
    .slice(0, 5);

  const topActions = actionTypes
    .map((action) => ({
      id: action.id,
      name: action.displayName,
      parameterCount: action.config.parameters?.length || 0,
      ruleCount: action.config.rules?.length || 0,
    }))
    .sort((a, b) => b.ruleCount - a.ruleCount)
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Dense operational snapshot of your MetaFlow setup
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="text-xl font-semibold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Object Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {totalProperties} total properties across schema
            </p>
            <div className="divide-y border rounded-md">
              {topTypes.map((type) => (
                <div key={type.id} className="px-3 py-2 flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{type.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {type.propertyCount} props • {type.picklistCount} picklists
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Action Density</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {relationships.filter(r => r.cardinality === 'MANY_TO_MANY').length} M:N relationships • {objectTypes.filter(t => t.config.isJunction).length} junction types
            </div>
            <div className="divide-y border rounded-md">
              {topActions.map((action) => (
                <div key={action.id} className="px-3 py-2 flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{action.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {action.parameterCount} params • {action.ruleCount} rules
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
