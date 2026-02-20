// TransitionActionModal - Simple modal for creating transition actions

'use client';

import { useState, useEffect } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StateNodeData } from '../../lib/process/stateNodeGenerator';
import {
  generateTransitionAction,
  buildTransitionInput,
} from '../../lib/process/transitionActionGenerator';

interface TransitionActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceState: StateNodeData | null;
  targetState: StateNodeData | null;
  onConfirm: (displayName: string, config: any) => Promise<void>;
}

export default function TransitionActionModal({
  open,
  onOpenChange,
  sourceState,
  targetState,
  onConfirm,
}: TransitionActionModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Set default name when modal opens
  useEffect(() => {
    if (open && sourceState && targetState) {
      setDisplayName(`${sourceState.stateValue} → ${targetState.stateValue}`);
    }
  }, [open, sourceState, targetState]);

  const handleConfirm = async () => {
    if (!sourceState || !targetState || !displayName.trim()) return;

    setIsCreating(true);
    try {
      const generated = generateTransitionAction(
        buildTransitionInput(sourceState, targetState)
      );
      await onConfirm(displayName.trim(), generated.config);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create action:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!sourceState || !targetState) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create Transition</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Visual transition */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="px-3 py-1.5 rounded-full border-2 border-primary bg-primary/10 text-sm font-medium">
              {sourceState.stateValue}
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <div className="px-3 py-1.5 rounded-full border-2 border-green-500 bg-green-500/10 text-sm font-medium">
              {targetState.stateValue}
            </div>
          </div>

          {/* Editable name */}
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Action name"
            className="text-center"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isCreating || !displayName.trim()}>
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
