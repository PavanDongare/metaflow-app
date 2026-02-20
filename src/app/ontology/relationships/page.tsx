'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft, ArrowRight, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/lib/auth/tenant-context';
import { useRelationships, useObjectTypes } from '../../lib/hooks';
import { deleteRelationship } from '../../lib/queries/relationships';
import { RelationshipForm } from '../../components/ontology/RelationshipForm';

const CARDINALITY_LABELS = {
  ONE_TO_MANY: '1:M',
  MANY_TO_ONE: 'M:1',
  MANY_TO_MANY: 'M:N',
};

const CARDINALITY_COLORS = {
  ONE_TO_MANY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  MANY_TO_ONE: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  MANY_TO_MANY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
};

export default function RelationshipsPage() {
  const { tenantId } = useTenant();
  const { relationships, loading: relsLoading, error: relsError, refetch } = useRelationships();
  const { objectTypes, loading: typesLoading } = useObjectTypes();
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loading = relsLoading || typesLoading;

  const getTypeName = (id: string) => {
    const type = objectTypes.find(t => t.id === id);
    return type?.displayName || id;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this relationship?')) {
      return;
    }

    setDeleting(id);
    try {
      await deleteRelationship(id, tenantId);
      refetch();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ontology">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Relationships</h1>
            <p className="text-muted-foreground">
              Define connections between object types
            </p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Relationship
          </Button>
        )}
      </div>

      {/* Error */}
      {relsError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {relsError}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Relationship</CardTitle>
            <CardDescription>
              Define a new relationship between object types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RelationshipForm
              tenantId={tenantId}
              onSuccess={() => {
                setShowForm(false);
                refetch();
              }}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Relationships List */}
      {relationships.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowRight className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Relationships</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create relationships to connect your object types
            </p>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Relationship
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {relationships.map((rel) => (
            <Card key={rel.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      CARDINALITY_COLORS[rel.cardinality]
                    }`}
                  >
                    {CARDINALITY_LABELS[rel.cardinality]}
                  </span>
                  <div>
                    <div className="font-medium">{rel.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {getTypeName(rel.sourceObjectTypeId)} <ArrowRight className="inline w-3 h-3" /> {getTypeName(rel.targetObjectTypeId)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(rel.id)}
                  disabled={deleting === rel.id}
                >
                  {deleting === rel.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-destructive" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
