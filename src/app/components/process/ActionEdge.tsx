// ActionEdge - Labeled edge representing a state transition action

import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';

export interface ActionEdgeData {
  actionId: string;
  actionName?: string;
  hasExtras?: boolean;
}

function ActionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<ActionEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { actionName, hasExtras } = data || {};

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: 3,
          stroke: '#000000',
        }}
      />
      {actionName && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="flex items-center gap-1 px-2 py-1 bg-card border rounded text-xs font-medium text-foreground hover:border-primary transition-colors cursor-pointer">
              <span>{actionName}</span>
              {hasExtras && (
                <span className="text-xs text-muted-foreground">+</span>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(ActionEdge);
