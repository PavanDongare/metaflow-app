// PicklistManager - Sidebar for managing tracked picklists

import type { ObjectType } from '../../lib/types';

interface PicklistManagerProps {
  objectTypes: ObjectType[];
  trackedPicklists: string[];
  onAddPicklist: (objectTypeId: string, propertyKey: string) => void;
  onRemovePicklist: (objectTypeId: string, propertyKey: string) => void;
}

export default function PicklistManager({
  objectTypes,
  trackedPicklists,
  onAddPicklist,
  onRemovePicklist,
}: PicklistManagerProps) {
  // Find all picklists for an object type
  const findPicklists = (objectType: ObjectType) => {
    const properties = objectType.config.properties || {};
    return Object.entries(properties)
      .filter(([_, prop]) => prop.type === 'string' && prop.picklistConfig)
      .map(([key, prop]) => ({
        key,
        displayName: prop.displayName || key,
      }));
  };

  return (
    <div className="border-l bg-card w-80 p-4 overflow-y-auto flex flex-col">
      <h3 className="font-semibold mb-4 text-foreground">Tracked Picklists</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Select which picklists to show as workflow states
      </p>

      <div className="flex-1 space-y-6">
        {objectTypes.map((objectType) => {
          const picklists = findPicklists(objectType);

          if (picklists.length === 0) {
            return null;
          }

          return (
            <div key={objectType.id} className="border-b pb-4">
              <h4 className="font-medium text-sm text-foreground mb-3">
                {objectType.displayName}
              </h4>
              <div className="space-y-2">
                {picklists.map(({ key, displayName }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={trackedPicklists.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onAddPicklist(objectType.id, key);
                        } else {
                          onRemovePicklist(objectType.id, key);
                        }
                      }}
                      className="rounded border-input text-primary cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground">
                      {displayName}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground border-t pt-4 mt-4">
        Uncheck a picklist to remove its states from the canvas
      </div>
    </div>
  );
}
