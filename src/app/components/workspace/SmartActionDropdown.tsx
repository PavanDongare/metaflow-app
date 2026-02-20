'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2, AlertTriangle, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAvailableActionsForObject } from '../../lib/hooks/use-actions';
import { ActionExecutionModal } from './ActionExecutionModal';
import type { ObjectInstance } from '../../lib/types/ontology';
import type { ActionListItem } from '../../lib/types/actions';

interface SmartActionDropdownProps {
  objectId: string;
  objectTypeId: string;
  currentObject?: ObjectInstance;
  onActionExecuted?: () => void;
}

export function SmartActionDropdown({
  objectId,
  objectTypeId,
  currentObject,
  onActionExecuted,
}: SmartActionDropdownProps) {
  const { actions, loading, error, refetch } = useAvailableActionsForObject(objectId);
  const [selectedAction, setSelectedAction] = useState<ActionListItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const handleSelectChange = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    setSelectedAction(action || null);
  };

  const handleExecute = () => {
    if (selectedAction) {
      setModalOpen(true);
    }
  };

  const handleSuccess = () => {
    refetch();
    onActionExecuted?.();
    router.refresh();
    setSelectedAction(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-48 h-9 bg-muted rounded-md animate-pulse" />
        <div className="w-20 h-9 bg-muted rounded-md animate-pulse" />
      </div>
    );
  }

  if (error || !actions.length) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        No actions available
      </div>
    );
  }

  // Group actions by classification
  const recommended = actions.filter(a => a.classification === 'recommended');
  const independent = actions.filter(a => a.classification === 'independent');
  const other = actions.filter(a => a.classification === 'other');

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={selectedAction?.id || ''} onValueChange={handleSelectChange}>
          <SelectTrigger className="w-56 h-9">
            <SelectValue placeholder="Select action..." />
          </SelectTrigger>
          <SelectContent className="w-56">
            {recommended.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />
                  Recommended
                </div>
                {recommended.map((action) => (
                  <SelectItem key={action.id} value={action.id}>
                    <span className="flex items-center gap-2">
                      <Star className="w-3 h-3 text-yellow-500" />
                      {action.displayName}
                    </span>
                  </SelectItem>
                ))}
              </>
            )}
            {independent.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-500" />
                  Independent
                </div>
                {independent.map((action) => (
                  <SelectItem key={action.id} value={action.id}>
                    <span className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-blue-500" />
                      {action.displayName}
                    </span>
                  </SelectItem>
                ))}
              </>
            )}
            {other.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Other
                </div>
                {other.map((action) => (
                  <SelectItem key={action.id} value={action.id}>
                    {action.displayName}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>

        <Button
          onClick={handleExecute}
          disabled={!selectedAction || loading}
          size="sm"
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Execute
        </Button>
      </div>

      {selectedAction && currentObject && (
        <ActionExecutionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          action={selectedAction}
          currentObject={currentObject}
          objectTypeId={objectTypeId}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
