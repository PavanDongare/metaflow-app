'use client';

import React, { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import type { RelationshipCardinality } from '../../lib/types/ontology';

interface RelationshipEdgeData {
  label: string;
  cardinality: RelationshipCardinality;
}

// Color mapping by cardinality
const CARDINALITY_COLORS = {
  ONE_TO_MANY: '#3b82f6',   // Blue
  MANY_TO_ONE: '#10b981',   // Green
  MANY_TO_MANY: '#8b5cf6',  // Purple
};

// Cardinality notation mapping
const CARDINALITY_LABELS = {
  ONE_TO_MANY: '1:M',
  MANY_TO_ONE: 'M:1',
  MANY_TO_MANY: 'M:N',
};

export const RelationshipEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<RelationshipEdgeData>) => {
  const { label, cardinality } = data || {};
  const color = CARDINALITY_COLORS[cardinality || 'ONE_TO_MANY'];
  const cardinalityLabel = CARDINALITY_LABELS[cardinality || 'ONE_TO_MANY'];

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Determine marker types based on cardinality
  const markerStart =
    cardinality === 'MANY_TO_ONE' || cardinality === 'MANY_TO_MANY'
      ? `url(#crows-foot-${cardinality})`
      : undefined;

  const markerEnd =
    cardinality === 'ONE_TO_MANY' || cardinality === 'MANY_TO_MANY'
      ? `url(#crows-foot-${cardinality})`
      : cardinality === 'MANY_TO_ONE'
      ? `url(#circle-${cardinality})`
      : undefined;

  return (
    <>
      {/* SVG Marker Definitions */}
      <defs>
        {/* Crow's Foot Marker (Many side) */}
        <marker
          id={`crows-foot-${cardinality}`}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
        >
          <path
            d="M 2 2 L 6 6 L 2 10"
            stroke={color}
            strokeWidth="1.5"
            fill="none"
          />
        </marker>

        {/* Circle Marker (One side) */}
        <marker
          id={`circle-${cardinality}`}
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
        >
          <circle
            cx="4"
            cy="4"
            r="3"
            stroke={color}
            strokeWidth="1.5"
            fill="white"
          />
        </marker>
      </defs>

      {/* Edge Path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: 2,
        }}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />

      {/* Edge Label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan bg-card px-2 py-1 rounded border border-border text-xs"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="px-1.5 py-0.5 rounded text-xs font-bold"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {cardinalityLabel}
              </span>
              <span className="font-medium text-foreground">{label}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

RelationshipEdge.displayName = 'RelationshipEdge';
