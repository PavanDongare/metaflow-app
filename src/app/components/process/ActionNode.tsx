// ActionNode - Rectangle node for actions

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AlertTriangle } from 'lucide-react';

export interface ActionNodeData {
  actionId: string;
  actionName: string;
  isOrphaned: boolean;
  orphanReason?: string;
}

function ActionNode({ data }: NodeProps<ActionNodeData>) {
  const { actionName, isOrphaned, orphanReason } = data;

  return (
    <div
      className={`
        px-4 py-2 rounded-lg border transition-all cursor-pointer
        ${
          isOrphaned
            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
            : 'border-border bg-card hover:border-primary'
        }
      `}
      style={{ minWidth: '180px' }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2"
        style={{ background: isOrphaned ? '#eab308' : 'hsl(var(--muted-foreground))' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2"
        style={{ background: isOrphaned ? '#eab308' : 'hsl(var(--muted-foreground))' }}
      />

      {/* Action name */}
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-foreground flex-1">{actionName}</div>
        {isOrphaned && <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />}
      </div>

      {/* Orphan reason */}
      {isOrphaned && orphanReason && (
        <div className="text-xs text-muted-foreground mt-1">{orphanReason}</div>
      )}
    </div>
  );
}

export default memo(ActionNode);
