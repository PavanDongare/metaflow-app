'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/lib/auth/tenant-context';
import { ObjectTypeConfigForm } from '../../components/ontology/ObjectTypeConfigForm';
import { createObjectType } from '../../lib/queries/object-types';
import type { ObjectType, ObjectTypeConfig } from '../../lib/types/ontology';

export default function NewObjectTypePage() {
  const router = useRouter();
  const { tenantId } = useTenant();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<ObjectType>>({
    displayName: '',
    config: {
      properties: {},
      titleKey: '',
    } as ObjectTypeConfig,
  });

  const handleSave = async () => {
    if (!formData.displayName?.trim()) {
      setError('Display name is required');
      return;
    }

    if (!formData.config?.titleKey && Object.keys(formData.config?.properties || {}).length > 0) {
      setError('Title key is required when properties are defined');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createObjectType(tenantId, {
        displayName: formData.displayName,
        config: formData.config!,
      });
      router.push('/ontology');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/ontology">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">New Object Type</h1>
            <p className="text-muted-foreground">
              Define a new entity type for your ontology
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Form */}
      <ObjectTypeConfigForm value={formData} onChange={setFormData} />
    </div>
  );
}
