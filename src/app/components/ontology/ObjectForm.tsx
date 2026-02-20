'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ForeignKeySelect } from './ForeignKeySelect';
import { validateObject } from '../../lib/validation/validator';
import { X } from 'lucide-react';
import type { ObjectType } from '../../lib/types/ontology';

interface Props {
  objectType: ObjectType;
  onSave: (data: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

export function ObjectForm({ objectType, onSave, onCancel }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const properties = objectType.config.properties;

  const handleSubmit = async () => {
    // Client-side validation
    const validationErrors = validateObject(formData, properties);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      await onSave(formData);
      setFormData({});
    } catch (err: any) {
      // Handle server-side validation errors
      if (err.message.includes('Validation failed')) {
        try {
          const errorData = JSON.parse(err.message.split('Validation failed')[1]);
          if (errorData.errors) {
            setErrors(errorData.errors);
            return;
          }
        } catch {
          // Fallback to generic error
        }
      }
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">New Record</h3>
        <button onClick={onCancel} className="p-1 hover:bg-accent rounded">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {Object.entries(properties).map(([key, prop]) => (
          <div key={key}>
            <label className="block text-xs font-medium mb-1">
              {prop.displayName}
              {prop.required && <span className="text-destructive"> *</span>}
            </label>

            {/* String */}
            {prop.type === 'string' && (
              <>
                {prop.picklistConfig ? (
                  // Render picklist select
                  prop.picklistConfig.allowMultiple ? (
                    // Multi-select
                    <select
                      multiple
                      value={formData[key] || prop.picklistConfig.defaultValue || []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setFormData({ ...formData, [key]: selected });
                      }}
                      className="w-full border rounded px-3 py-2 text-sm bg-background"
                      required={prop.required}
                      size={Math.min(prop.picklistConfig.options.length, 5)}
                    >
                      {prop.picklistConfig.options.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    // Single-select
                    <select
                      value={formData[key] || prop.picklistConfig.defaultValue || ''}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm bg-background"
                      required={prop.required}
                    >
                      <option value="">Select {prop.displayName}...</option>
                      {prop.picklistConfig.options.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  )
                ) : (
                  // Regular text input (existing code)
                  <Input
                    value={formData[key] || ''}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={prop.displayName}
                    className="text-sm"
                    maxLength={prop.validation?.maxLength}
                    required={prop.required}
                  />
                )}
              </>
            )}

            {/* Number */}
            {prop.type === 'number' && (
              <Input
                type="number"
                step="any"
                value={formData[key] || ''}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="text-sm"
                min={prop.validation?.min}
                max={prop.validation?.max}
                required={prop.required}
              />
            )}

            {/* Boolean */}
            {prop.type === 'boolean' && (
              <input
                type="checkbox"
                checked={formData[key] || false}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                className="w-4 h-4"
              />
            )}

            {/* Timestamp */}
            {prop.type === 'timestamp' && (
              <Input
                type="datetime-local"
                value={formData[key] || ''}
                onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                className="text-sm"
                required={prop.required}
              />
            )}

            {/* Array */}
            {prop.type === 'array' && (
              <textarea
                value={formData[key] ? JSON.stringify(formData[key]) : ''}
                onChange={(e) => {
                  try {
                    setFormData({ ...formData, [key]: JSON.parse(e.target.value) });
                  } catch {
                    // Invalid JSON, keep as string
                  }
                }}
                placeholder="Enter JSON array"
                className="w-full border rounded px-2 py-1 text-sm font-mono bg-background"
                rows={3}
                required={prop.required}
              />
            )}

            {/* Foreign Key */}
            {prop.type === 'object-reference' && (
              <>
                {prop.referenceConfig?.targetObjectTypeId ? (
                  <ForeignKeySelect
                    targetTypeId={prop.referenceConfig.targetObjectTypeId}
                    value={formData[key] || ''}
                    onChange={(value) => setFormData({ ...formData, [key]: value })}
                    required={prop.required}
                    displayName={prop.displayName}
                  />
                ) : (
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
                    FK not configured - edit object type to set target entity
                  </div>
                )}
              </>
            )}

            {/* Error Message */}
            {errors[key] && (
              <p className="text-xs text-destructive mt-1">{errors[key]}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button onClick={handleSubmit} disabled={saving} size="sm" className="h-8">
          {saving ? 'Saving...' : 'Save Record'}
        </Button>
        <Button variant="outline" onClick={onCancel} size="sm" className="h-8">
          Cancel
        </Button>
      </div>
    </div>
  );
}
