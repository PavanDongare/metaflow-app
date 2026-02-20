'use client';

import { Check } from 'lucide-react';
import { useObjectProcessState } from '../../lib/hooks/use-process';
import { useObjectType } from '../../lib/hooks/use-ontology';

interface StatusBreadcrumbProps {
  objectTypeId: string;
  objectData: Record<string, unknown>;
}

export function StatusBreadcrumb({ objectTypeId, objectData }: StatusBreadcrumbProps) {
  const { process, currentState, stateProperty, loading, error } = useObjectProcessState(
    objectTypeId,
    objectData
  );
  const { objectType } = useObjectType(objectTypeId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-pulse text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !process || !stateProperty || !objectType) {
    return null;
  }

  const statePropertyDef = objectType.config.properties[stateProperty];
  if (!statePropertyDef?.picklistConfig?.options) {
    return null;
  }

  const stages = statePropertyDef.picklistConfig.options;
  const currentIndex = currentState ? stages.indexOf(currentState) : -1;

  return (
    <div className="border rounded-md bg-card">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <span className="text-sm font-medium">{process.processName}</span>
        <span className="text-xs text-muted-foreground">
          Stage {currentIndex + 1} of {stages.length}
        </span>
      </div>

      {/* Salesforce-style Path */}
      <div className="p-4">
        <div className="flex">
          {stages.map((stage, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isFirst = index === 0;
            const isLast = index === stages.length - 1;

            return (
              <div
                key={stage}
                className="flex-1 relative"
              >
                {/* Chevron segment */}
                <div
                  className={`
                    relative h-9 flex items-center justify-center text-xs font-medium
                    ${isFirst ? 'rounded-l-md' : ''}
                    ${isLast ? 'rounded-r-md' : ''}
                    ${isCompleted
                      ? 'bg-foreground text-background'
                      : isCurrent
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                    }
                  `}
                  style={{
                    clipPath: isLast
                      ? 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)'
                      : isFirst
                      ? 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
                      : 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)',
                    marginLeft: isFirst ? '0' : '-8px',
                  }}
                >
                  <span className="flex items-center gap-1.5 px-3">
                    {isCompleted && <Check className="w-3 h-3" />}
                    {stage}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
