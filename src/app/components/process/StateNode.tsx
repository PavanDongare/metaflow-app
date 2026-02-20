// StateNode - Oval node representing a state value from picklist

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { StateNodeData } from '../../lib/process/stateNodeGenerator';

function StateNode({ data }: NodeProps<StateNodeData>) {
  const { stateValue, color } = data;

  return (
    <div
      className="px-4 py-2 rounded-full border-2 bg-blue-50 dark:bg-blue-950 transition-shadow hover:ring-2 hover:ring-primary/20"
      style={{
        borderColor: color || 'hsl(var(--primary))',
        minWidth: '100px',
      }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5"
        style={{ background: color || 'hsl(var(--primary))' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5"
        style={{ background: color || 'hsl(var(--primary))' }}
      />

      {/* State value label */}
      <div className="text-xs font-medium text-foreground text-center whitespace-nowrap">
        {stateValue}
      </div>
    </div>
  );
}

export default memo(StateNode);
