'use client';

// React Hooks for Relationships

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/auth/tenant-context';
import type { Relationship } from '../types';
import {
  getRelationships,
  getRelationship,
  getRelationshipsByObjectType,
  createRelationship as createRelationshipFn,
  updateRelationship as updateRelationshipFn,
  deleteRelationship as deleteRelationshipFn,
} from '../queries/relationships';

export function useRelationships() {
  const { tenantId } = useTenant();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRelationships(tenantId);
      setRelationships(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { relationships, loading, error, refetch };
}

export function useRelationship(id: string | null) {
  const { tenantId } = useTenant();
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getRelationship(id, tenantId);
      setRelationship(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { relationship, setRelationship, loading, error, refetch };
}

export function useRelationshipsByObjectType(objectTypeId: string | null) {
  const { tenantId } = useTenant();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!objectTypeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getRelationshipsByObjectType(objectTypeId, tenantId);
      setRelationships(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [objectTypeId, tenantId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { relationships, loading, error, refetch };
}

// Re-export mutations
export const createRelationship = createRelationshipFn;
export const updateRelationship = updateRelationshipFn;
export const deleteRelationship = deleteRelationshipFn;
