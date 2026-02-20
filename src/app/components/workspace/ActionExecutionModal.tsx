'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTenant } from '@/lib/auth/tenant-context';
import { ForeignKeySelect } from '../ontology/ForeignKeySelect';
import { executeAction } from '../../lib/hooks/use-actions';
import type { ActionListItem } from '../../lib/types/actions';
import type { ObjectInstance } from '../../lib/types/ontology';

interface ActionExecutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ActionListItem;
  currentObject: ObjectInstance;
  objectTypeId: string;
  onSuccess?: () => void;
}

export function ActionExecutionModal({
  open,
  onOpenChange,
  action,
  currentObject,
  objectTypeId,
  onSuccess,
}: ActionExecutionModalProps) {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pre-fill with current object as first parameter
  const firstParam = action.parameters?.[0];
  const [parameters, setParameters] = useState<Record<string, unknown>>({
    [firstParam?.name || 'object']: currentObject.id,
  });

  const handleParameterChange = (paramName: string, value: unknown) => {
    setParameters(prev => ({ ...prev, [paramName]: value }));
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await executeAction(action.id, tenantId, parameters);

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          onSuccess?.();
          // Reset state for next open
          setSuccess(false);
          setError(null);
        }, 1500);
      } else {
        setError(response.error || 'Action execution failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error executing action');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !success) {
      onOpenChange(false);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {success ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>{action.displayName} Executed Successfully</span>
              </>
            ) : (
              <>
                {action.classification === 'recommended' && (
                  <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full" />
                )}
                Execute: {action.displayName}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <p className="text-green-700 font-medium">Action completed successfully!</p>
            <p className="text-sm text-muted-foreground">Changes will be reflected shortly.</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Description */}
            {action.description && (
              <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded">
                {action.description}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {/* Parameters Form */}
            {action.parameters && action.parameters.length > 0 && (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                <label className="text-sm font-medium">Parameters</label>
                {action.parameters.map((param) => (
                  <div key={param.name} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {param.displayName || param.name}
                      {param.required && <span className="text-destructive ml-1">*</span>}
                    </label>

                    {/* Object Reference Parameter */}
                    {param.type === 'object-reference' && param.objectTypeId ? (
                      <ForeignKeySelect
                        targetTypeId={param.objectTypeId}
                        value={(parameters[param.name] as string) || ''}
                        onChange={(value) => handleParameterChange(param.name, value)}
                        displayName={param.displayName || param.name}
                        disabled={loading || (param.name === firstParam?.name)}
                      />
                    ) : param.type === 'string' && param.picklistConfig ? (
                      /* Picklist Parameter */
                      <select
                        value={(parameters[param.name] as string) || ''}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        disabled={loading}
                        className="w-full px-3 py-2 border rounded text-sm bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="">
                          Select {param.displayName || param.name}...
                        </option>
                        {param.picklistConfig.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : param.type === 'boolean' ? (
                      /* Boolean Parameter */
                      <input
                        type="checkbox"
                        checked={(parameters[param.name] as boolean) || false}
                        onChange={(e) => handleParameterChange(param.name, e.target.checked)}
                        disabled={loading}
                        className="w-4 h-4 rounded border-input"
                      />
                    ) : param.type === 'number' ? (
                      /* Number Parameter */
                      <Input
                        type="number"
                        value={(parameters[param.name] as number) || ''}
                        onChange={(e) =>
                          handleParameterChange(param.name, parseFloat(e.target.value))
                        }
                        disabled={loading}
                      />
                    ) : param.type === 'timestamp' ? (
                      /* Date Parameter */
                      <Input
                        type="datetime-local"
                        value={(parameters[param.name] as string) || ''}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        disabled={loading}
                      />
                    ) : (
                      /* Text Parameter (default) */
                      <Input
                        type="text"
                        value={(parameters[param.name] as string) || ''}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        disabled={loading || param.name === firstParam?.name}
                        placeholder={param.displayName || param.name}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Criteria Info */}
            {action.criteriaPassed === false && (
              <div className="flex gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Note:</p>
                  <p>This action may not meet all submission criteria. Proceed at your own risk.</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading || success}>
            {success ? 'Close' : 'Cancel'}
          </Button>
          {!success && (
            <Button
              onClick={handleExecute}
              disabled={loading || !Object.values(parameters).filter(Boolean).length}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Executing...' : 'Execute'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
