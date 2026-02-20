'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Trash2, Loader2, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenant } from '@/lib/auth/tenant-context';
import { useObjectTypes } from '../../lib/hooks/use-ontology';
import { createActionType } from '../../lib/hooks/use-actions';
import { getSupabase } from '@/lib/supabase';
import type { ActionParameter, ActionRule, PropertyValueConfig } from '../../lib/types/actions';

// Chain Builder Types
interface ChainOption {
  key: string;
  label: string;
  type: 'terminal' | 'M:1' | '1:M' | 'M:N';
  baseType?: string;
  targetTypeId?: string;
}

interface ChainNode {
  type: 'parameter' | 'property';
  value: string | null;
  options: ChainOption[];
  requiresQuantifier?: boolean;
  quantifierValue?: 'ANY' | 'ALL';
  targetTypeId?: string;
}

export default function NewActionPage() {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { objectTypes } = useObjectTypes();

  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [executionType, setExecutionType] = useState<'declarative' | 'function-backed'>('declarative');
  const [functionName, setFunctionName] = useState('');

  const [parameters, setParameters] = useState<ActionParameter[]>([]);
  const [rules, setRules] = useState<ActionRule[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submission Criteria State
  const [chain, setChain] = useState<ChainNode[]>([]);
  const [operator, setOperator] = useState<string>('equals');
  const [compareValue, setCompareValue] = useState<string>('');
  const [isTerminal, setIsTerminal] = useState(false);
  const [showTesting, setShowTesting] = useState(false);
  const [testObjectId, setTestObjectId] = useState<string>('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingInProgress, setTestingInProgress] = useState(false);
  const [availableTestObjects, setAvailableTestObjects] = useState<{ id: string; display: string }[]>([]);

  // Parameter management
  const addParameter = () => {
    setParameters([
      ...parameters,
      {
        name: '',
        type: 'string',
        displayName: '',
        required: false,
      },
    ]);
  };

  const updateParameter = (index: number, updates: Partial<ActionParameter>) => {
    const newParams = [...parameters];
    newParams[index] = { ...newParams[index], ...updates };
    setParameters(newParams);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  // Rule management
  const addRule = (type: 'create_object' | 'modify_object' | 'delete_object') => {
    if (type === 'create_object') {
      setRules([
        ...rules,
        { type: 'create_object', objectTypeId: '', properties: {} },
      ]);
    } else if (type === 'modify_object') {
      setRules([
        ...rules,
        { type: 'modify_object', objectParameter: '', properties: {} },
      ]);
    } else {
      setRules([...rules, { type: 'delete_object', objectParameter: '' }]);
    }
  };

  const updateRule = (index: number, updates: Partial<ActionRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates } as ActionRule;
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const addPropertyToRule = (ruleIndex: number, propertyName: string) => {
    const rule = rules[ruleIndex];
    if (rule.type === 'create_object' || rule.type === 'modify_object') {
      updateRule(ruleIndex, {
        properties: {
          ...rule.properties,
          [propertyName]: { source: 'static', value: '' },
        },
      });
    }
  };

  const updatePropertyInRule = (
    ruleIndex: number,
    propertyName: string,
    value: PropertyValueConfig
  ) => {
    const rule = rules[ruleIndex];
    if (rule.type === 'create_object' || rule.type === 'modify_object') {
      updateRule(ruleIndex, {
        properties: {
          ...rule.properties,
          [propertyName]: value,
        },
      });
    }
  };

  const removePropertyFromRule = (ruleIndex: number, propertyName: string) => {
    const rule = rules[ruleIndex];
    if (rule.type === 'create_object' || rule.type === 'modify_object') {
      const newProps = { ...rule.properties };
      delete newProps[propertyName];
      updateRule(ruleIndex, { properties: newProps });
    }
  };

  const getObjectTypeForRule = (ruleIndex: number) => {
    const rule = rules[ruleIndex];
    if (rule.type === 'create_object') {
      return objectTypes.find((t) => t.id === rule.objectTypeId);
    } else if (rule.type === 'modify_object') {
      const param = parameters.find((p) => p.name === rule.objectParameter);
      return param?.objectTypeId
        ? objectTypes.find((t) => t.id === param.objectTypeId)
        : null;
    }
    return null;
  };

  // ===== SUBMISSION CRITERIA CHAIN BUILDER =====

  // Get object-reference parameters for first dropdown
  const getParameterOptions = (): ChainOption[] => {
    return parameters
      .filter((p) => p.type === 'object-reference' && p.objectTypeId)
      .map((p) => ({
        key: p.name,
        label: p.displayName || p.name,
        type: 'M:1' as const,
        targetTypeId: p.objectTypeId,
      }));
  };

  // Get properties + relationships for an object type
  const getOptionsForType = (objectTypeId: string): ChainOption[] => {
    const objType = objectTypes.find((t) => t.id === objectTypeId);
    if (!objType) return [];

    const options: ChainOption[] = [];
    const props = objType.config?.properties || {};

    // Terminal properties (non-reference)
    Object.entries(props).forEach(([key, prop]: [string, any]) => {
      if (prop.type !== 'object-reference') {
        options.push({
          key,
          label: prop.displayName || key,
          type: 'terminal',
          baseType: prop.type,
        });
      }
    });

    // M:1 FK references
    Object.entries(props).forEach(([key, prop]: [string, any]) => {
      if (prop.type === 'object-reference' && prop.referenceConfig?.targetObjectTypeId) {
        const targetType = objectTypes.find((t) => t.id === prop.referenceConfig?.targetObjectTypeId);
        options.push({
          key,
          label: `${prop.displayName || key} (→ ${targetType?.displayName || 'object'})`,
          type: 'M:1',
          targetTypeId: prop.referenceConfig.targetObjectTypeId,
        });
      }
    });

    return options;
  };

  // Handle chain navigation
  const handleChainSelect = (index: number, value: string) => {
    const node = chain[index];
    const option = node.options.find((o) => o.key === value);
    if (!option) return;

    const newChain = [...chain];
    newChain[index] = { ...node, value };

    // Remove nodes after this
    newChain.splice(index + 1);

    // Reset terminal state
    setIsTerminal(false);

    if (option.type === 'terminal') {
      setChain(newChain);
      setIsTerminal(true);
      return;
    }

    if (option.type === '1:M' || option.type === 'M:N') {
      newChain[index].requiresQuantifier = true;
      newChain[index].targetTypeId = option.targetTypeId;
      setChain(newChain);
      return;
    }

    // M:1 - add next node immediately
    if (option.type === 'M:1' && option.targetTypeId) {
      newChain.push({
        type: 'property',
        value: null,
        options: getOptionsForType(option.targetTypeId),
      });
      setChain(newChain);
    }
  };

  // Handle ANY/ALL quantifier selection
  const handleQuantifierSelect = (index: number, quantifier: 'ANY' | 'ALL') => {
    const newChain = [...chain];
    newChain[index].quantifierValue = quantifier;
    newChain[index].requiresQuantifier = false;

    const targetTypeId = newChain[index].targetTypeId;
    if (targetTypeId) {
      newChain.push({
        type: 'property',
        value: null,
        options: getOptionsForType(targetTypeId),
      });
    }

    setChain(newChain);
  };

  // Build Expression object from chain
  const buildSubmissionCriteriaFromChain = (): any | null => {
    if (!isTerminal || chain.length === 0 || !chain[0].value || !operator) {
      return null;
    }

    // For null operators, we don't need compareValue
    if (!['is_null', 'is_not_null'].includes(operator) && !compareValue) {
      return null;
    }

    // Build segments from chain (skip first which is parameter)
    const segments: any[] = [];
    for (let i = 1; i < chain.length; i++) {
      const node = chain[i];
      if (!node.value) break;

      const option = node.options.find((o) => o.key === node.value);
      if (!option || option.type === 'terminal') break;

      const segment: any = {
        propertyKey: node.value,
        objectTypeId: option.targetTypeId,
        relationshipType: option.type === 'M:N' ? 'M:N' : 'M:1',
      };

      if (node.quantifierValue) {
        segment.quantifier = node.quantifierValue;
      }

      segments.push(segment);
    }

    // Get terminal property key
    const lastNode = chain[chain.length - 1];
    const terminalPropertyKey = lastNode?.value || '';

    return {
      type: 'comparison',
      left: {
        type: 'property',
        path: {
          baseParameterName: chain[0]?.value || '',
          segments,
          terminalPropertyKey,
        },
      },
      operator,
      right: {
        type: 'static',
        value: compareValue,
      },
    };
  };

  // Human-readable description
  const getConditionDescription = (): string => {
    if (chain.length === 0 || !chain[0].value) {
      return 'No condition defined';
    }

    let description = '';

    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      if (!node.value) break;

      const selectedOption = node.options.find((o) => o.key === node.value);
      if (!selectedOption) break;

      if (i === 0) {
        description += selectedOption.label;
      } else {
        description += ` → ${selectedOption.label}`;
      }

      if (node.quantifierValue) {
        description += ` (${node.quantifierValue === 'ANY' ? 'Any' : 'All'})`;
      }
    }

    if (isTerminal && operator) {
      const operatorSymbol =
        operator === 'equals' ? '=' :
        operator === 'not_equals' ? '≠' :
        operator === 'gt' ? '>' :
        operator === 'gte' ? '≥' :
        operator === 'lt' ? '<' :
        operator === 'lte' ? '≤' :
        operator === 'is_null' ? 'is null' :
        operator === 'is_not_null' ? 'is not null' :
        operator;

      if (['is_null', 'is_not_null'].includes(operator)) {
        description += ` ${operatorSymbol}`;
      } else if (compareValue) {
        description += ` ${operatorSymbol} "${compareValue}"`;
      }
    }

    return description;
  };

  // Clear criteria
  const clearCriteria = () => {
    const paramOptions = getParameterOptions();
    setChain(paramOptions.length > 0 ? [{ type: 'parameter', value: null, options: paramOptions }] : []);
    setIsTerminal(false);
    setCompareValue('');
    setOperator('equals');
    setTestResult(null);
    setTestObjectId('');
  };

  // Initialize chain when object-reference parameters exist
  useEffect(() => {
    const paramOptions = getParameterOptions();
    if (paramOptions.length > 0 && chain.length === 0) {
      setChain([{ type: 'parameter', value: null, options: paramOptions }]);
    } else if (paramOptions.length === 0 && chain.length > 0) {
      setChain([]);
      setIsTerminal(false);
    }
  }, [parameters, objectTypes]);

  // Fetch test objects when testing is opened
  useEffect(() => {
    if (showTesting && chain.length > 0 && chain[0].value) {
      fetchTestObjects();
    }
  }, [showTesting, chain[0]?.value]);

  const fetchTestObjects = async () => {
    try {
      const firstParam = parameters.find((p) => p.name === chain[0]?.value);
      if (!firstParam || firstParam.type !== 'object-reference' || !firstParam.objectTypeId) {
        return;
      }

      const supabase = getSupabase('metaflow');
      const { data, error } = await supabase
        .from('objects')
        .select('id, data')
        .eq('tenant_id', tenantId)
        .eq('object_type_id', firstParam.objectTypeId)
        .limit(50);

      if (error) throw error;

      const objType = objectTypes.find((t) => t.id === firstParam.objectTypeId);
      const titleKey = objType?.config?.titleKey || 'id';

      const objects = (data || []).map((obj: any) => ({
        id: obj.id,
        display: obj.data?.[titleKey] || obj.id,
      }));

      setAvailableTestObjects(objects);
    } catch (err) {
      console.error('Failed to fetch test objects:', err);
      setAvailableTestObjects([]);
    }
  };

  // Test the condition
  const handleTestCondition = async () => {
    if (!testObjectId || !isTerminal) {
      setTestResult({ success: false, message: 'Please complete the condition and select a test object' });
      return;
    }

    setTestingInProgress(true);
    setTestResult(null);

    try {
      const supabase = getSupabase('metaflow');
      const expression = buildSubmissionCriteriaFromChain();

      if (!expression) {
        setTestResult({ success: false, message: 'Invalid criteria configuration' });
        setTestingInProgress(false);
        return;
      }

      const { data, error } = await supabase.rpc('evaluate_submission_criteria', {
        p_expression: expression,
        p_parameters: { [chain[0]?.value || '']: testObjectId },
        p_tenant_id: tenantId,
      });

      if (error) throw error;

      const passed = data?.passed === true;
      setTestResult({
        success: passed,
        message: passed
          ? '✓ Condition PASSED - The test object satisfies the criteria'
          : '✗ Condition FAILED - The test object does not satisfy the criteria',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Error: ${err.message}`,
      });
    } finally {
      setTestingInProgress(false);
    }
  };

  // ===== END SUBMISSION CRITERIA =====

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    if (executionType === 'declarative' && rules.length === 0) {
      setError('At least one rule is required for declarative actions');
      return;
    }

    if (executionType === 'function-backed' && !functionName.trim()) {
      setError('Function name is required for function-backed actions');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const config: any = {
        executionType,
        parameters,
        description: description || undefined,
      };

      // Add submission criteria if defined
      const criteria = buildSubmissionCriteriaFromChain();
      if (criteria) {
        config.submissionCriteria = [criteria];
      }

      if (executionType === 'declarative') {
        config.rules = rules;
      } else {
        config.functionName = functionName;
      }

      const created = await createActionType(tenantId, {
        displayName,
        config,
      });

      router.push(`/actions/${created.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
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
            <h1 className="text-2xl font-bold">Create Action</h1>
            <p className="text-muted-foreground">Define a new action type</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saving ? 'Creating...' : 'Create Action'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Approve Order"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this action does"
            />
          </div>

          <div className="space-y-2">
            <Label>Execution Type *</Label>
            <Select
              value={executionType}
              onValueChange={(v) => setExecutionType(v as 'declarative' | 'function-backed')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="declarative">Declarative (Rule-based)</SelectItem>
                <SelectItem value="function-backed">Function-backed (Custom SQL)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {executionType === 'declarative'
                ? 'Define rules that generate SQL automatically'
                : 'Call a custom PostgreSQL function'}
            </p>
          </div>

          {executionType === 'function-backed' && (
            <div className="space-y-2">
              <Label htmlFor="functionName">Function Name *</Label>
              <Input
                id="functionName"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                placeholder="e.g., process_order"
              />
              <p className="text-xs text-muted-foreground">
                Function must accept (parameters JSONB, tenant_id UUID) and return JSONB
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parameters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Parameters</CardTitle>
          <Button variant="outline" size="sm" onClick={addParameter}>
            <Plus className="w-4 h-4 mr-2" />
            Add Parameter
          </Button>
        </CardHeader>
        <CardContent>
          {parameters.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
              No parameters yet
            </p>
          ) : (
            <div className="space-y-4">
              {parameters.map((param, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Parameter {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeParameter(index)}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name *</Label>
                      <Input
                        value={param.name}
                        onChange={(e) => updateParameter(index, { name: e.target.value })}
                        placeholder="parameter_name"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Display Name *</Label>
                      <Input
                        value={param.displayName || ''}
                        onChange={(e) => updateParameter(index, { displayName: e.target.value })}
                        placeholder="Parameter Name"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Type *</Label>
                      <Select
                        value={param.type}
                        onValueChange={(v) => updateParameter(index, { type: v as any })}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                          <SelectItem value="timestamp">Timestamp</SelectItem>
                          <SelectItem value="object-reference">Object Reference</SelectItem>
                          <SelectItem value="array">Array</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {param.type === 'object-reference' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Object Type</Label>
                        <Select
                          value={param.objectTypeId || ''}
                          onValueChange={(v) => updateParameter(index, { objectTypeId: v })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {objectTypes.filter((type) => type).map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.displayName || type.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={param.required}
                      onChange={(e) => updateParameter(index, { required: e.target.checked })}
                      id={`required-${index}`}
                      className="rounded"
                    />
                    <Label htmlFor={`required-${index}`} className="text-xs">
                      Required
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules (Declarative only) */}
      {executionType === 'declarative' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rules</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => addRule('create_object')}>
                <Plus className="w-4 h-4 mr-1" />
                Create
              </Button>
              <Button variant="outline" size="sm" onClick={() => addRule('modify_object')}>
                <Plus className="w-4 h-4 mr-1" />
                Modify
              </Button>
              <Button variant="outline" size="sm" onClick={() => addRule('delete_object')}>
                <Plus className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
                No rules yet. Add at least one rule.
              </p>
            ) : (
              <div className="space-y-4">
                {rules.map((rule, ruleIndex) => (
                  <div
                    key={ruleIndex}
                    className="border-2 border-primary/20 rounded-lg p-4 space-y-3 bg-primary/5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold capitalize">
                          {rule.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Rule {ruleIndex + 1}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRule(ruleIndex)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>

                    {/* Create Object Rule */}
                    {rule.type === 'create_object' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Object Type *</Label>
                          <Select
                            value={rule.objectTypeId}
                            onValueChange={(v) => updateRule(ruleIndex, { objectTypeId: v })}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select object type..." />
                            </SelectTrigger>
                            <SelectContent>
                              {objectTypes.filter((type) => type).map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.displayName || type.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {rule.objectTypeId && (
                          <PropertyBuilder
                            ruleIndex={ruleIndex}
                            rule={rule}
                            objectType={getObjectTypeForRule(ruleIndex)}
                            parameters={parameters}
                            onAddProperty={addPropertyToRule}
                            onUpdateProperty={updatePropertyInRule}
                            onRemoveProperty={removePropertyFromRule}
                          />
                        )}
                      </div>
                    )}

                    {/* Modify Object Rule */}
                    {rule.type === 'modify_object' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Object Parameter *</Label>
                          <Select
                            value={rule.objectParameter}
                            onValueChange={(v) => updateRule(ruleIndex, { objectParameter: v })}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select parameter..." />
                            </SelectTrigger>
                            <SelectContent>
                              {parameters
                                .filter((p) => p && p.type === 'object-reference')
                                .map((p) => (
                                  <SelectItem key={p.name} value={p.name}>
                                    {p.displayName || p.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {rule.objectParameter && (
                          <PropertyBuilder
                            ruleIndex={ruleIndex}
                            rule={rule}
                            objectType={getObjectTypeForRule(ruleIndex)}
                            parameters={parameters}
                            onAddProperty={addPropertyToRule}
                            onUpdateProperty={updatePropertyInRule}
                            onRemoveProperty={removePropertyFromRule}
                          />
                        )}
                      </div>
                    )}

                    {/* Delete Object Rule */}
                    {rule.type === 'delete_object' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Object Parameter *</Label>
                        <Select
                          value={rule.objectParameter}
                          onValueChange={(v) => updateRule(ruleIndex, { objectParameter: v })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select parameter..." />
                          </SelectTrigger>
                          <SelectContent>
                            {parameters
                              .filter((p) => p && p.type === 'object-reference')
                              .map((p) => (
                                <SelectItem key={p.name} value={p.name}>
                                  {p.displayName || p.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submission Criteria */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Criteria</CardTitle>
          <CardDescription>
            Define when this action can be executed (optional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {parameters.filter((p) => p.type === 'object-reference' && p.objectTypeId).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
              Add an object-reference parameter first to define criteria
            </p>
          ) : (
            <>
              {/* Chain Builder */}
              <div className="flex flex-wrap items-center gap-2">
                {chain.map((node, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {index > 0 && <span className="text-muted-foreground">→</span>}

                    <Select
                      value={node.value || ''}
                      onValueChange={(v) => handleChainSelect(index, v)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder={index === 0 ? 'Select parameter...' : 'Select property...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Group terminal properties */}
                        {node.options.filter((o) => o.type === 'terminal').length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Properties</SelectLabel>
                            {node.options
                              .filter((o) => o.type === 'terminal')
                              .map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        )}
                        {/* Group M:1 references */}
                        {node.options.filter((o) => o.type === 'M:1').length > 0 && (
                          <SelectGroup>
                            <SelectLabel>References (→)</SelectLabel>
                            {node.options
                              .filter((o) => o.type === 'M:1')
                              .map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Quantifier selection for 1:M / M:N */}
                    {node.requiresQuantifier && (
                      <div className="flex gap-1 bg-yellow-100 dark:bg-yellow-900/30 p-1 rounded">
                        <Button
                          size="sm"
                          variant={node.quantifierValue === 'ANY' ? 'default' : 'outline'}
                          onClick={() => handleQuantifierSelect(index, 'ANY')}
                          className="h-7"
                        >
                          Any
                        </Button>
                        <Button
                          size="sm"
                          variant={node.quantifierValue === 'ALL' ? 'default' : 'outline'}
                          onClick={() => handleQuantifierSelect(index, 'ALL')}
                          className="h-7"
                        >
                          All
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Operator & Value (when terminal property is selected) */}
                {isTerminal && (
                  <>
                    <Select value={operator} onValueChange={setOperator}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">=</SelectItem>
                        <SelectItem value="not_equals">≠</SelectItem>
                        <SelectItem value="gt">&gt;</SelectItem>
                        <SelectItem value="gte">≥</SelectItem>
                        <SelectItem value="lt">&lt;</SelectItem>
                        <SelectItem value="lte">≤</SelectItem>
                        <SelectItem value="is_null">is null</SelectItem>
                        <SelectItem value="is_not_null">is not null</SelectItem>
                      </SelectContent>
                    </Select>

                    {!['is_null', 'is_not_null'].includes(operator) && (
                      <Input
                        value={compareValue}
                        onChange={(e) => setCompareValue(e.target.value)}
                        placeholder="value"
                        className="w-32"
                      />
                    )}
                  </>
                )}
              </div>

              {/* Description */}
              {chain.length > 0 && chain[0].value && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    <strong>Condition:</strong> {getConditionDescription()}
                  </p>
                  <Button variant="ghost" size="sm" onClick={clearCriteria}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              )}

              {/* Testing Section */}
              {isTerminal && (compareValue || ['is_null', 'is_not_null'].includes(operator)) && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">Test Condition</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTesting(!showTesting)}
                    >
                      {showTesting ? 'Hide' : 'Show'} Testing
                    </Button>
                  </div>

                  {showTesting && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Select value={testObjectId} onValueChange={setTestObjectId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select test object..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTestObjects.map((obj) => (
                              <SelectItem key={obj.id} value={obj.id}>
                                {obj.display}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          onClick={handleTestCondition}
                          disabled={!testObjectId || testingInProgress}
                        >
                          {testingInProgress ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {testResult && (
                        <div
                          className={`p-3 rounded text-sm ${
                            testResult.success
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          }`}
                        >
                          {testResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Property Builder Component
function PropertyBuilder({
  ruleIndex,
  rule,
  objectType,
  parameters,
  onAddProperty,
  onUpdateProperty,
  onRemoveProperty,
}: {
  ruleIndex: number;
  rule: any;
  objectType: any;
  parameters: ActionParameter[];
  onAddProperty: (ruleIndex: number, propertyName: string) => void;
  onUpdateProperty: (ruleIndex: number, propertyName: string, value: PropertyValueConfig) => void;
  onRemoveProperty: (ruleIndex: number, propertyName: string) => void;
}) {
  const [selectedProperty, setSelectedProperty] = useState('');

  if (!objectType) return null;

  const availableProps = Object.entries(objectType.config?.properties || {})
    .filter(([key, prop]) => prop && !Object.keys(rule.properties || {}).includes(key))
    .map(([key, prop]: [string, any]) => ({
      key,
      displayName: prop?.displayName || key,
      type: prop?.type || 'string',
    }));

  const handleAdd = () => {
    if (selectedProperty) {
      onAddProperty(ruleIndex, selectedProperty);
      setSelectedProperty('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Properties</Label>
        <div className="flex gap-2">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="Select property..." />
            </SelectTrigger>
            <SelectContent>
              {availableProps.map((prop) => (
                <SelectItem key={prop.key} value={prop.key}>
                  {prop.displayName || prop.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={handleAdd}
            disabled={!selectedProperty}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {Object.keys(rule.properties || {}).length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded">
          No properties yet
        </p>
      ) : (
        <div className="space-y-2">
          {Object.entries(rule.properties || {}).map(([propName, propValue]: [string, any]) => (
            <div key={propName} className="border rounded p-2 bg-background">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{propName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onRemoveProperty(ruleIndex, propName)}
                >
                  <X className="w-3 h-3 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={propValue.source}
                  onValueChange={(v) =>
                    onUpdateProperty(ruleIndex, propName, { ...propValue, source: v })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static Value</SelectItem>
                    <SelectItem value="parameter">From Parameter</SelectItem>
                    <SelectItem value="current_user">Current User</SelectItem>
                    <SelectItem value="current_timestamp">Current Timestamp</SelectItem>
                  </SelectContent>
                </Select>

                {propValue.source === 'static' && (
                  <Input
                    value={propValue.value || ''}
                    onChange={(e) =>
                      onUpdateProperty(ruleIndex, propName, {
                        source: 'static',
                        value: e.target.value,
                      })
                    }
                    placeholder="Value"
                    className="h-7 text-xs"
                  />
                )}

                {propValue.source === 'parameter' && (
                  <Select
                    value={propValue.parameterName || ''}
                    onValueChange={(v) =>
                      onUpdateProperty(ruleIndex, propName, {
                        source: 'parameter',
                        parameterName: v,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {parameters.filter((p) => p).map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.displayName || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
