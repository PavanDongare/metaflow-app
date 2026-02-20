'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenant } from '@/lib/auth/tenant-context';
import { useActionType, executeAction, deleteActionType } from '../../lib/hooks/use-actions';
import { useObjectTypes } from '../../lib/hooks/use-ontology';
import { ForeignKeySelect } from '../../components/ontology/ForeignKeySelect';

export default function ActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: actionId } = use(params);
  const { tenantId } = useTenant();

  const { actionType, loading, error } = useActionType(actionId);
  const { objectTypes } = useObjectTypes();

  const [executing, setExecuting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [execError, setExecError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !actionType) {
    return (
      <div className="p-6">
        <div className="text-destructive mb-4">
          {error || 'Action not found'}
        </div>
        <Link href="/actions">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Actions
          </Button>
        </Link>
      </div>
    );
  }

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const isFormValid = () => {
    return actionType.config.parameters.every((param) => {
      if (param.required) {
        const value = parameters[param.name];
        return value !== undefined && value !== null && value !== '';
      }
      return true;
    });
  };

  const handleExecute = async () => {
    setExecuting(true);
    setExecError(null);
    setResult(null);

    try {
      const response = await executeAction(actionId, tenantId, parameters);

      if (response.success) {
        setResult(response.result);
        setParameters({});
      } else {
        setExecError(response.error || 'Action execution failed');
      }
    } catch (err: any) {
      setExecError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this action? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      await deleteActionType(actionId, tenantId);
      router.push('/actions');
    } catch (err: any) {
      setExecError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/actions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{actionType.displayName}</h1>
            <p className="text-muted-foreground">
              {actionType.config.executionType === 'declarative'
                ? 'Declarative Action'
                : 'Function-backed Action'}
            </p>
          </div>
        </div>
        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          <Trash2 className="w-4 h-4 mr-2" />
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      {/* Execute Form */}
      <Card>
        <CardHeader>
          <CardTitle>Execute Action</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {actionType.config.description && (
            <p className="text-sm text-muted-foreground">
              {actionType.config.description}
            </p>
          )}

          {/* Parameters Form */}
          {actionType.config.parameters.length > 0 ? (
            <div className="space-y-4">
              {actionType.config.parameters.map((param) => (
                <div key={param.name} className="space-y-2">
                  <Label>
                    {param.displayName}
                    {param.required && <span className="text-destructive ml-1">*</span>}
                  </Label>

                  {param.type === 'object-reference' && param.objectTypeId ? (
                    <ForeignKeySelect
                      targetTypeId={param.objectTypeId}
                      value={parameters[param.name] || ''}
                      onChange={(value) => handleParameterChange(param.name, value)}
                      displayName={param.displayName}
                    />
                  ) : param.type === 'boolean' ? (
                    <Select
                      value={
                        parameters[param.name] === true
                          ? 'true'
                          : parameters[param.name] === false
                          ? 'false'
                          : ''
                      }
                      onValueChange={(v) =>
                        handleParameterChange(param.name, v === 'true')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : param.type === 'number' ? (
                    <Input
                      type="number"
                      value={parameters[param.name] || ''}
                      onChange={(e) =>
                        handleParameterChange(
                          param.name,
                          e.target.value ? parseFloat(e.target.value) : ''
                        )
                      }
                      placeholder={`Enter ${param.displayName.toLowerCase()}`}
                    />
                  ) : param.type === 'timestamp' ? (
                    <Input
                      type="datetime-local"
                      value={parameters[param.name] || ''}
                      onChange={(e) =>
                        handleParameterChange(param.name, e.target.value)
                      }
                    />
                  ) : param.picklistConfig ? (
                    <Select
                      value={parameters[param.name] || ''}
                      onValueChange={(v) => handleParameterChange(param.name, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${param.displayName.toLowerCase()}...`} />
                      </SelectTrigger>
                      <SelectContent>
                        {param.picklistConfig.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="text"
                      value={parameters[param.name] || ''}
                      onChange={(e) =>
                        handleParameterChange(param.name, e.target.value)
                      }
                      placeholder={`Enter ${param.displayName.toLowerCase()}`}
                    />
                  )}

                  {param.description && (
                    <p className="text-xs text-muted-foreground">{param.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This action has no parameters.
            </p>
          )}

          <Button
            onClick={handleExecute}
            disabled={executing || !isFormValid()}
            className="w-full"
          >
            <Play className="w-4 h-4 mr-2" />
            {executing ? 'Executing...' : 'Execute Action'}
          </Button>

          {/* Error Display */}
          {execError && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {execError}
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                Success!
              </p>
              <pre className="text-xs text-green-700 dark:text-green-300 overflow-auto max-h-48">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Display */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs text-muted-foreground overflow-auto max-h-96 p-4 bg-muted rounded">
            {JSON.stringify(actionType.config, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
