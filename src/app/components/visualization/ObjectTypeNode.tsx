'use client';

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Database } from 'lucide-react';
import type { PropertyDef } from '../../lib/types/ontology';
import { cn } from '@/lib/utils';

interface ObjectTypeNodeData {
  label: string;
  propertyCount: number;
  relationshipCount: number;
  isJunction: boolean;
  properties: Record<string, PropertyDef>;
}

interface Props {
  data: ObjectTypeNodeData;
  selected?: boolean;
}

export const ObjectTypeNode = memo(({ data, selected }: Props) => {
  const { label, isJunction } = data;

  return (
    <div
      className={cn(
        'rounded-md border bg-card',
        selected ? 'border-blue-500 border-2' : 'border-border',
        isJunction ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' : ''
      )}
      style={{ width: 180 }}
    >
      {/* Handles for connections */}
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />

      {/* Content */}
      <div className="flex items-center gap-2.5 px-3 py-3">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md flex-shrink-0',
            isJunction ? 'bg-purple-200 dark:bg-purple-800' : 'bg-muted'
          )}
        >
          <Database className="h-4.5 w-4.5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">
            {label}
          </h3>
          {isJunction && (
            <span className="inline-block mt-1 text-xs font-medium text-purple-700 dark:text-purple-300">
              Junction
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

ObjectTypeNode.displayName = 'ObjectTypeNode';
