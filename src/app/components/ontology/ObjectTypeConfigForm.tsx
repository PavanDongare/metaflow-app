'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useObjectTypes } from '../../lib/hooks';
import { Trash2, Plus, AlertCircle, Check, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import type { ObjectType, PropertyType } from '../../lib/types/ontology';

interface Props {
  value: Partial<ObjectType>;
  onChange: (updated: Partial<ObjectType>) => void;
}

export function ObjectTypeConfigForm({ value, onChange }: Props) {
  const properties = value.config?.properties || {};
  const { objectTypes } = useObjectTypes();
  const [isAddingField, setIsAddingField] = useState(false);
  const [tempFieldName, setTempFieldName] = useState('');
  const [tempType, setTempType] = useState<PropertyType>('string');
  const [tempRequired, setTempRequired] = useState(false);
  const [tempFkTarget, setTempFkTarget] = useState('');
  const [tempMaxLength, setTempMaxLength] = useState<number | ''>('');
  const [tempMin, setTempMin] = useState<number | ''>('');
  const [tempMax, setTempMax] = useState<number | ''>('');
  const [tempPicklistOptions, setTempPicklistOptions] = useState<string>('');
  const [tempAllowMultiple, setTempAllowMultiple] = useState(false);
  const [tempIsPicklist, setTempIsPicklist] = useState(false);
  const [tempDefaultValue, setTempDefaultValue] = useState<string>('');
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);

  const propertyKeys = Object.keys(properties);

  const updateProperty = (key: string, updates: any) => {
    onChange({
      ...value,
      config: {
        ...value.config!,
        properties: {
          ...properties,
          [key]: { ...properties[key], ...updates },
        },
      },
    });
  };

  const handleAddField = () => {
    const fieldName = tempFieldName.trim();
    if (!fieldName) {
      return;
    }

    // Check for duplicates
    if (properties[fieldName]) {
      alert(`Field "${fieldName}" already exists. Please use a different name.`);
      return;
    }

    // Validate FK target is selected
    if (tempType === 'object-reference' && !tempFkTarget) {
      alert('Please select a target entity for the reference field.');
      return;
    }

    // Build property definition with type-specific config
    const propertyDef: any = {
      displayName: fieldName,
      type: tempType,
      required: tempRequired,
    };

    // Add FK config
    if (tempType === 'object-reference' && tempFkTarget) {
      propertyDef.referenceConfig = {
        targetObjectTypeId: tempFkTarget,
      };
    }

    // Add validation config for strings
    if (tempType === 'string' && tempMaxLength) {
      propertyDef.validation = {
        maxLength: Number(tempMaxLength),
      };
    }

    // Add picklist config for strings
    if (tempType === 'string' && tempIsPicklist && tempPicklistOptions) {
      const options = tempPicklistOptions.split(',').map(o => o.trim()).filter(o => o);
      if (options.length > 0) {
        propertyDef.picklistConfig = {
          options,
          allowMultiple: tempAllowMultiple,
        };

        // Add default value if specified
        if (tempDefaultValue) {
          if (tempAllowMultiple) {
            propertyDef.picklistConfig.defaultValue =
              tempDefaultValue.split(',').map(o => o.trim()).filter(o => o);
          } else {
            propertyDef.picklistConfig.defaultValue = tempDefaultValue.trim();
          }
        }
      }
    }

    // Add validation config for numbers
    if (tempType === 'number') {
      const validation: any = {};
      if (tempMin !== '') validation.min = Number(tempMin);
      if (tempMax !== '') validation.max = Number(tempMax);
      if (Object.keys(validation).length > 0) {
        propertyDef.validation = validation;
      }
    }

    onChange({
      ...value,
      config: {
        ...value.config!,
        properties: {
          ...properties,
          [fieldName]: propertyDef,
        },
      },
    });

    // Reset all temp values
    setTempFieldName('');
    setTempType('string');
    setTempRequired(false);
    setTempFkTarget('');
    setTempMaxLength('');
    setTempMin('');
    setTempMax('');
    setTempIsPicklist(false);
    setTempPicklistOptions('');
    setTempAllowMultiple(false);
    setTempDefaultValue('');
  };

  const cancelAddField = () => {
    setIsAddingField(false);
    setTempFieldName('');
    setTempType('string');
    setTempRequired(false);
    setTempFkTarget('');
    setTempMaxLength('');
    setTempMin('');
    setTempMax('');
  };

  const deleteProperty = (key: string) => {
    const { [key]: _, ...rest } = properties;
    const newConfig = { ...value.config!, properties: rest };

    // Clear title if deleting that field
    if (value.config?.titleKey === key) {
      newConfig.titleKey = '';
    }

    onChange({
      ...value,
      config: newConfig,
    });
  };

  const setTitleKey = (key: string) => {
    onChange({
      ...value,
      config: { ...value.config!, titleKey: key },
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-card border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">Basic Information</h3>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Display Name <span className="text-destructive">*</span>
          </label>
          <Input
            value={value.displayName || ''}
            onChange={(e) => onChange({ ...value, displayName: e.target.value })}
            placeholder="e.g., Customer, Product, Order"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Human-readable name for this entity type
          </p>
        </div>
      </div>

      {/* Properties */}
      <div className="bg-card border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4">
          Properties {propertyKeys.length > 0 && (
            <span className="text-muted-foreground font-normal">({propertyKeys.length})</span>
          )}
        </h3>

        {/* Add Field Placeholder - at TOP */}
        {!isAddingField && (
          <button
            onClick={() => setIsAddingField(true)}
            className="w-full border-2 border-dashed rounded-lg p-4 text-center hover:bg-accent hover:border-muted-foreground transition-colors mb-4"
          >
            <Plus className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">Add Field</span>
          </button>
        )}

        {/* Inline Add Mode */}
        {isAddingField && (
          <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 mb-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              {/* Field Name */}
              <div>
                <label className="text-xs font-medium block mb-1.5">
                  Field Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={tempFieldName}
                  onChange={(e) => setTempFieldName(e.target.value)}
                  placeholder="e.g., Email Address"
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tempFieldName.trim()) {
                      handleAddField();
                    }
                    if (e.key === 'Escape') {
                      cancelAddField();
                    }
                  }}
                />
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-medium block mb-1.5">Type</label>
                <select
                  value={tempType}
                  onChange={(e) => setTempType(e.target.value as PropertyType)}
                  className="w-full h-8 border rounded px-2 text-sm bg-background"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="timestamp">Timestamp</option>
                  <option value="object-reference">Reference (FK)</option>
                  <option value="array">Array</option>
                </select>
              </div>

              {/* Required */}
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempRequired}
                    onChange={(e) => setTempRequired(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-xs font-medium">Required</span>
                </label>
              </div>
            </div>

            {/* Type-Specific Configuration */}
            {tempType === 'object-reference' && (
              <div className="mb-3 pb-3 border-b">
                <label className="text-xs font-medium block mb-1.5">
                  Target Entity <span className="text-destructive">*</span>
                </label>
                <select
                  value={tempFkTarget}
                  onChange={(e) => setTempFkTarget(e.target.value)}
                  className="w-full h-8 border rounded px-2 text-sm bg-background"
                >
                  <option value="">Select target entity...</option>
                  {objectTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.displayName}</option>
                  ))}
                </select>
              </div>
            )}

            {tempType === 'string' && (
              <div className="mb-3 pb-3 border-b">
                <label className="text-xs font-medium block mb-1.5">
                  Max Length (optional)
                </label>
                <Input
                  type="number"
                  value={tempMaxLength}
                  onChange={(e) => setTempMaxLength(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g., 255"
                  className="h-8 w-32"
                  min="1"
                />

                {/* Picklist Configuration */}
                <div className="border-t pt-3 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={tempIsPicklist}
                      onChange={(e) => setTempIsPicklist(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs font-medium">Use as Picklist</span>
                  </label>

                  {tempIsPicklist && (
                    <>
                      <div className="mb-2">
                        <label className="text-xs font-medium block mb-1.5">
                          Options (comma-separated)
                        </label>
                        <Input
                          value={tempPicklistOptions}
                          onChange={(e) => setTempPicklistOptions(e.target.value)}
                          placeholder="e.g., Active, Pending, Closed"
                          className="h-8"
                        />
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={tempAllowMultiple}
                          onChange={(e) => setTempAllowMultiple(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-xs">Allow multiple selection</span>
                      </label>

                      <div>
                        <label className="text-xs font-medium block mb-1.5">
                          Default Value (optional)
                        </label>
                        <Input
                          value={tempDefaultValue}
                          onChange={(e) => setTempDefaultValue(e.target.value)}
                          placeholder={tempAllowMultiple ? "e.g., Active, Pending" : "e.g., Active"}
                          className="h-8"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {tempType === 'number' && (
              <div className="mb-3 pb-3 border-b grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1.5">
                    Min (optional)
                  </label>
                  <Input
                    type="number"
                    value={tempMin}
                    onChange={(e) => setTempMin(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Minimum value"
                    className="h-8"
                    step="any"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5">
                    Max (optional)
                  </label>
                  <Input
                    type="number"
                    value={tempMax}
                    onChange={(e) => setTempMax(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Maximum value"
                    className="h-8"
                    step="any"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleAddField}
                disabled={!tempFieldName.trim() || (tempType === 'object-reference' && !tempFkTarget)}
                size="sm"
                className="h-8"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Add Field
              </Button>
              <Button
                onClick={cancelAddField}
                variant="outline"
                size="sm"
                className="h-8"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Properties Table */}
        {propertyKeys.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">No fields yet. Add your first field above.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase w-8"></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Type</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase">Required</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {propertyKeys.map((key) => {
                  const prop = properties[key];
                  const isExpanded = expandedProperty === key;
                  return (
                    <React.Fragment key={key}>
                      <tr className="hover:bg-accent">
                        {/* Expand Toggle */}
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setExpandedProperty(isExpanded ? null : key)}
                            className="p-1 hover:bg-muted rounded"
                            title={isExpanded ? "Collapse" : "Expand config"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </td>

                        {/* Name */}
                        <td className="px-3 py-2">
                          <span className="text-sm">{prop.displayName}</span>
                        </td>

                        {/* Type */}
                        <td className="px-3 py-2">
                          <select
                            value={prop.type}
                            onChange={(e) => updateProperty(key, { type: e.target.value as PropertyType })}
                            className="w-full h-7 border rounded px-2 text-sm bg-background"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                            <option value="timestamp">Timestamp</option>
                            <option value="object-reference">Reference (FK)</option>
                            <option value="array">Array</option>
                          </select>
                        </td>

                        {/* Required */}
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={prop.required || false}
                            onChange={(e) => updateProperty(key, { required: e.target.checked })}
                            className="w-3.5 h-3.5"
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setExpandedProperty(isExpanded ? null : key)}
                              className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950 rounded text-blue-600"
                              title="Edit config"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteProperty(key)}
                              className="p-1 hover:bg-red-50 dark:hover:bg-red-950 rounded text-red-600"
                              title="Delete field"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Config Row */}
                      {isExpanded && (
                        <tr className="bg-blue-50 dark:bg-blue-950/30">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="text-xs font-semibold uppercase mb-3">Advanced Configuration</div>

                            {/* FK Configuration */}
                            {prop.type === 'object-reference' && (
                              <div className="mt-3 pt-3 border-t">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                                      Target Entity <span className="text-destructive">*</span>
                                    </label>
                                    <select
                                      value={prop.referenceConfig?.targetObjectTypeId || ''}
                                      onChange={(e) =>
                                        updateProperty(key, {
                                          referenceConfig: {
                                            ...prop.referenceConfig,
                                            targetObjectTypeId: e.target.value
                                          },
                                        })
                                      }
                                      className="w-full h-8 border rounded px-2 text-sm bg-background"
                                    >
                                      <option value="">Select target entity...</option>
                                      {objectTypes.map((t) => (
                                        <option key={t.id} value={t.id}>{t.displayName}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={prop.referenceConfig?.cascadeDelete || false}
                                        onChange={(e) =>
                                          updateProperty(key, {
                                            referenceConfig: {
                                              ...prop.referenceConfig,
                                              cascadeDelete: e.target.checked
                                            },
                                          })
                                        }
                                        className="w-3.5 h-3.5"
                                      />
                                      <span className="text-xs">Cascade Delete</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* String Validation */}
                            {prop.type === 'string' && (
                              <div className="mt-3 pt-3 border-t">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Min Length</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={prop.validation?.minLength || ''}
                                      onChange={(e) =>
                                        updateProperty(key, {
                                          validation: {
                                            ...prop.validation,
                                            minLength: e.target.value ? parseInt(e.target.value) : undefined
                                          },
                                        })
                                      }
                                      placeholder="Optional"
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Max Length</label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={prop.validation?.maxLength || ''}
                                      onChange={(e) =>
                                        updateProperty(key, {
                                          validation: {
                                            ...prop.validation,
                                            maxLength: e.target.value ? parseInt(e.target.value) : undefined
                                          },
                                        })
                                      }
                                      placeholder="Optional"
                                      className="h-8"
                                    />
                                  </div>
                                </div>

                                {/* Picklist Configuration */}
                                <div className="border-t pt-3 mt-3">
                                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input
                                      type="checkbox"
                                      checked={!!prop.picklistConfig}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          updateProperty(key, {
                                            picklistConfig: {
                                              options: [],
                                              allowMultiple: false,
                                            }
                                          });
                                        } else {
                                          const { picklistConfig, ...rest } = prop;
                                          updateProperty(key, rest);
                                        }
                                      }}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-xs font-medium">Use as Picklist</span>
                                  </label>

                                  {prop.picklistConfig && (
                                    <>
                                      <div className="mb-2">
                                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Options</label>
                                        <Input
                                          value={prop.picklistConfig.options.join(', ')}
                                          onChange={(e) => {
                                            const options = e.target.value.split(',').map(o => o.trim()).filter(o => o);
                                            updateProperty(key, {
                                              picklistConfig: {
                                                ...prop.picklistConfig,
                                                options
                                              }
                                            });
                                          }}
                                          placeholder="e.g., Active, Pending, Closed"
                                          className="h-8"
                                        />
                                      </div>

                                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                                        <input
                                          type="checkbox"
                                          checked={prop.picklistConfig.allowMultiple || false}
                                          onChange={(e) => {
                                            updateProperty(key, {
                                              picklistConfig: {
                                                ...prop.picklistConfig,
                                                allowMultiple: e.target.checked
                                              }
                                            });
                                          }}
                                          className="w-3.5 h-3.5"
                                        />
                                        <span className="text-xs">Allow multiple selection</span>
                                      </label>

                                      <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                                          Default Value (optional)
                                        </label>
                                        <Input
                                          value={
                                            Array.isArray(prop.picklistConfig.defaultValue)
                                              ? prop.picklistConfig.defaultValue.join(', ')
                                              : prop.picklistConfig.defaultValue || ''
                                          }
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            updateProperty(key, {
                                              picklistConfig: {
                                                ...prop.picklistConfig,
                                                defaultValue: prop.picklistConfig?.allowMultiple
                                                  ? value.split(',').map(o => o.trim()).filter(o => o)
                                                  : value.trim()
                                              }
                                            });
                                          }}
                                          placeholder={prop.picklistConfig?.allowMultiple ? "e.g., Active, Pending" : "e.g., Active"}
                                          className="h-8"
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Number Validation */}
                            {prop.type === 'number' && (
                              <div className="mt-3 pt-3 border-t">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Min Value</label>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={prop.validation?.min || ''}
                                      onChange={(e) =>
                                        updateProperty(key, {
                                          validation: {
                                            ...prop.validation,
                                            min: e.target.value ? parseFloat(e.target.value) : undefined
                                          },
                                        })
                                      }
                                      placeholder="Optional"
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Max Value</label>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={prop.validation?.max || ''}
                                      onChange={(e) =>
                                        updateProperty(key, {
                                          validation: {
                                            ...prop.validation,
                                            max: e.target.value ? parseFloat(e.target.value) : undefined
                                          },
                                        })
                                      }
                                      placeholder="Optional"
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Title Key Selection Only */}
      {propertyKeys.length > 0 && (
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Display Configuration</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Select which field should be used as the display name for records.
            Unique IDs are auto-generated as "{value.displayName?.toLowerCase().replace(/\s+/g, '-') || 'object'}-01", etc.
          </p>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Title Key <span className="text-destructive">*</span>
            </label>
            <select
              value={value.config?.titleKey || ''}
              onChange={(e) => setTitleKey(e.target.value)}
              className="w-full h-9 border rounded px-3 text-sm bg-background"
            >
              <option value="">Select title key...</option>
              {propertyKeys.map((key) => (
                <option key={key} value={key}>
                  {properties[key].displayName} ({properties[key].type})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Display name for records in lists and references
            </p>
          </div>
        </div>
      )}

      {/* Validation Warning */}
      {propertyKeys.length > 0 && !value.config?.titleKey && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">Configuration Required</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You must select a title key before saving.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
