'use client';

import { Loader2 } from 'lucide-react';
import { useObjectTypes, useRelationships } from '../../lib/hooks';
import { OntologyVisualization } from '../../components/visualization/OntologyVisualization';
import { DesktopRecommended } from '@/components/desktop-recommended';

export default function VisualizationPage() {
  const { objectTypes, loading: typesLoading, error: typesError } = useObjectTypes();
  const { relationships, loading: relsLoading, error: relsError } = useRelationships();

  const loading = typesLoading || relsLoading;
  const error = typesError || relsError;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading ontology...</p>
        </div>
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
    <DesktopRecommended featureName="Ontology Visualization">
      <div className="h-[calc(100vh-120px)]">
        <OntologyVisualization
          objectTypes={objectTypes}
          relationships={relationships}
        />
      </div>
    </DesktopRecommended>
  );
}
