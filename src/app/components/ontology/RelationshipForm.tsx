'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useObjectTypes } from '../../lib/hooks';
import { createRelationship } from '../../lib/queries/relationships';
import { AlertCircle, ArrowRight } from 'lucide-react';
import type { ObjectType, RelationshipCardinality, PropertyDef } from '../../lib/types/ontology';

interface Props {
  tenantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RelationshipForm({ tenantId, onSuccess, onCancel }: Props) {
  const { objectTypes } = useObjectTypes();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [sourceObjectTypeId, setSourceObjectTypeId] = useState('');
  const [targetObjectTypeId, setTargetObjectTypeId] = useState('');
  const [cardinality, setCardinality] = useState<RelationshipCardinality>('MANY_TO_MANY');
  const [sourceDisplayName, setSourceDisplayName] = useState('');
  const [targetDisplayName, setTargetDisplayName] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [junctionDisplayName, setJunctionDisplayName] = useState('');

  // Get selected object types
  const sourceType = objectTypes.find((t) => t.id === sourceObjectTypeId);
  const targetType = objectTypes.find((t) => t.id === targetObjectTypeId);

  // Auto-populate display names when object types change
  useEffect(() => {
    if (sourceType && targetType) {
      if (!displayName) {
        setDisplayName(`${sourceType.displayName} to ${targetType.displayName}`);
      }
      if (!sourceDisplayName) {
        setSourceDisplayName(targetType.displayName);
      }
      if (!targetDisplayName) {
        setTargetDisplayName(sourceType.displayName);
      }
      if (cardinality === 'MANY_TO_MANY' && !junctionDisplayName) {
        setJunctionDisplayName(`${sourceType.displayName}_${targetType.displayName}`);
      }
    }
  }, [sourceType, targetType, cardinality]);

  // Get FK properties for 1:M / M:1 validation
  const getFkProperties = (objectType: ObjectType | undefined): string[] => {
    if (!objectType) return [];
    const props = objectType.config.properties || {};
    return Object.keys(props).filter((key) => props[key].type === 'object-reference');
  };

  const sourceTypeHasFk = !!(sourceType && getFkProperties(sourceType).length > 0);
  const targetTypeHasFk = !!(targetType && getFkProperties(targetType).length > 0);

  const canSelectCardinality = (card: RelationshipCardinality): boolean => {
    if (!sourceType || !targetType) return false;
    if (card === 'MANY_TO_MANY') return true;
    if (card === 'ONE_TO_MANY') return targetTypeHasFk;
    if (card === 'MANY_TO_ONE') return sourceTypeHasFk;
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    if (!sourceObjectTypeId || !targetObjectTypeId) {
      setError('Please select both source and target object types');
      return;
    }
    if (!sourceDisplayName.trim() || !targetDisplayName.trim()) {
      setError('Both display names are required');
      return;
    }
    if ((cardinality === 'ONE_TO_MANY' || cardinality === 'MANY_TO_ONE') && !propertyName) {
      setError('Please select a foreign key property');
      return;
    }

    setLoading(true);
    try {
      await createRelationship(tenantId, {
        displayName: displayName.trim(),
        cardinality,
        sourceObjectTypeId,
        targetObjectTypeId,
        sourceDisplayName: sourceDisplayName.trim(),
        targetDisplayName: targetDisplayName.trim(),
        propertyName: propertyName || undefined,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create relationship');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Source Object Type</label>
          <select
            value={sourceObjectTypeId}
            onChange={(e) => setSourceObjectTypeId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            required
          >
            <option value="">Select source type...</option>
            {objectTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.displayName}</option>
            ))}
          </select>
        </div>

        {sourceType && targetType && (
          <div className="flex items-center justify-center py-2">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Target Object Type</label>
          <select
            value={targetObjectTypeId}
            onChange={(e) => setTargetObjectTypeId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            required
          >
            <option value="">Select target type...</option>
            {objectTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Relationship Name</label>
          <Input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g., Employee Works On Project"
            required
          />
        </div>
      </div>

      {sourceType && targetType && (
        <div>
          <label className="block text-sm font-medium mb-2">Relationship Type</label>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-accent">
              <input
                type="radio"
                name="cardinality"
                value="MANY_TO_MANY"
                checked={cardinality === 'MANY_TO_MANY'}
                onChange={(e) => setCardinality(e.target.value as RelationshipCardinality)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">Many-to-Many (M:N)</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Creates a junction object type to store the relationships
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 border rounded-md ${
                canSelectCardinality('ONE_TO_MANY')
                  ? 'cursor-pointer hover:bg-accent'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <input
                type="radio"
                name="cardinality"
                value="ONE_TO_MANY"
                checked={cardinality === 'ONE_TO_MANY'}
                onChange={(e) => setCardinality(e.target.value as RelationshipCardinality)}
                disabled={!canSelectCardinality('ONE_TO_MANY')}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">One-to-Many (1:M)</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {targetTypeHasFk
                    ? `Uses existing foreign key in ${targetType.displayName}`
                    : `Requires a foreign key property in ${targetType.displayName}`}
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 border rounded-md ${
                canSelectCardinality('MANY_TO_ONE')
                  ? 'cursor-pointer hover:bg-accent'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <input
                type="radio"
                name="cardinality"
                value="MANY_TO_ONE"
                checked={cardinality === 'MANY_TO_ONE'}
                onChange={(e) => setCardinality(e.target.value as RelationshipCardinality)}
                disabled={!canSelectCardinality('MANY_TO_ONE')}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">Many-to-One (M:1)</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {sourceTypeHasFk
                    ? `Uses existing foreign key in ${sourceType.displayName}`
                    : `Requires a foreign key property in ${sourceType.displayName}`}
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {(cardinality === 'ONE_TO_MANY' || cardinality === 'MANY_TO_ONE') && sourceType && targetType && (
        <div>
          <label className="block text-sm font-medium mb-1">Foreign Key Property</label>
          <select
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            required
          >
            <option value="">Select property...</option>
            {getFkProperties(cardinality === 'ONE_TO_MANY' ? targetType : sourceType).map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            The foreign key property that references the related object type
          </p>
        </div>
      )}

      {cardinality === 'MANY_TO_MANY' && sourceType && targetType && (
        <div>
          <label className="block text-sm font-medium mb-1">Junction Object Type Name (Optional)</label>
          <Input
            type="text"
            value={junctionDisplayName}
            onChange={(e) => setJunctionDisplayName(e.target.value)}
            placeholder={`${sourceType.displayName}_${targetType.displayName}`}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Auto-generated junction object type to store the relationships
          </p>
        </div>
      )}

      {sourceType && targetType && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Source Label</label>
            <Input
              type="text"
              value={sourceDisplayName}
              onChange={(e) => setSourceDisplayName(e.target.value)}
              placeholder={`e.g., ${targetType.displayName}`}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">From {sourceType.displayName} perspective</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Label</label>
            <Input
              type="text"
              value={targetDisplayName}
              onChange={(e) => setTargetDisplayName(e.target.value)}
              placeholder={`e.g., ${sourceType.displayName}`}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">From {targetType.displayName} perspective</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Relationship'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
