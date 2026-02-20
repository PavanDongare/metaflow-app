'use client';

import Link from 'next/link';
import type { ObjectType, ObjectInstance, PropertyDef } from '../../lib/types/ontology';
import { ForeignKeyDisplay } from './ForeignKeyDisplay';

interface Props {
  objectType: ObjectType | null;
  objects: ObjectInstance[];
}

export function ObjectsTable({ objectType, objects }: Props) {
  if (!objectType) {
    return <div className="text-muted-foreground">No object type selected</div>;
  }

  if (objects.length === 0) {
    return (
      <div className="text-muted-foreground">
        No objects yet. Create one to see it here.
      </div>
    );
  }

  const properties = objectType.config.properties;
  const columns = Object.entries(properties);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <table className="w-full">
        <thead className="bg-muted border-b">
          <tr>
            {/* ID Column */}
            <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                ID
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 normal-case" title="Auto-generated ID">
                  Auto
                </span>
              </div>
            </th>
            {columns.map(([key, prop]) => (
              <th key={key} className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  {prop.displayName}
                  {key === objectType.config.titleKey && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 normal-case" title="Title Key">
                      T
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {objects.map((obj) => {
            // Always use UUID in URL for stability
            const detailUrl = `/workspace/${objectType.id}/${obj.id}`;
            // Display semantic ID for user-friendliness
            const displayId = obj.semanticId || obj.id.slice(0, 8);

            return (
              <tr key={obj.id} className="hover:bg-accent transition-colors group">
                {/* ID Column - Clickable */}
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={detailUrl}
                    className="text-blue-600 hover:underline font-mono font-medium"
                  >
                    {displayId}
                  </Link>
                </td>
                {columns.map(([key, prop]) => (
                  <td key={key} className="px-4 py-3 text-sm text-foreground">
                    {renderValue(obj.data[key], prop)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {objects.length > 0 && (
        <div className="px-4 py-2.5 bg-muted border-t text-xs text-muted-foreground flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">Auto</span>
            Auto-generated ID
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">T</span>
            Title Key
          </span>
          <span className="ml-auto">{objects.length} row{objects.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

function renderValue(value: any, prop: PropertyDef): React.ReactNode {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Type-specific rendering (using base types)
  switch (prop.type) {
    case 'string':
      // Handle multi-select picklist display
      if (prop.picklistConfig?.allowMultiple && Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
              >
                {v}
              </span>
            ))}
          </div>
        );
      }
      return <span>{String(value)}</span>;

    case 'number':
      return <span>{Number(value).toLocaleString()}</span>;

    case 'boolean':
      return <span className={value ? 'text-green-600' : 'text-muted-foreground'}>
        {value ? 'Yes' : 'No'}
      </span>;

    case 'timestamp':
      try {
        return <span>{new Date(value).toLocaleString()}</span>;
      } catch {
        return <span>{String(value)}</span>;
      }

    case 'object-reference':
      if (prop.referenceConfig?.targetObjectTypeId) {
        return (
          <ForeignKeyDisplay
            value={value}
            targetTypeId={prop.referenceConfig.targetObjectTypeId}
          />
        );
      }
      return <span className="text-muted-foreground">{String(value)}</span>;

    case 'array':
      if (Array.isArray(value)) {
        return <span>{value.length} items</span>;
      }
      return <span>{JSON.stringify(value)}</span>;

    default:
      // Fallback for unknown types
      if (typeof value === 'object') return <span>{JSON.stringify(value)}</span>;
      return <span>{String(value)}</span>;
  }
}
