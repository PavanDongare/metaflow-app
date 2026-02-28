import { getObjectTypes } from './object-types';
import { getRelationships } from './relationships';
import { getActionTypes } from './actions';
import { getProcessLayouts } from './layouts';

export async function exportConfig(tenantId: string) {
  const [objectTypes, relationships, actions, layouts] = await Promise.all([
    getObjectTypes(tenantId),
    getRelationships(tenantId),
    getActionTypes(tenantId),
    getProcessLayouts(tenantId),
  ]);

  return {
    version: 1,
    tenant: {
      id: tenantId,
      name: 'Current Tenant',
      slug: 'current',
    },
    app: {
      name: 'Dynamic MetaFlow App',
      description: 'Exported from Supabase live configuration',
    },
    objectTypes: objectTypes.map(ot => ({
      symbolicId: ot.symbolicId || `$object:${ot.id}`,
      displayName: ot.displayName,
      processFlag: ot.processFlag,
      config: ot.config,
    })),
    relationships: relationships.map(r => ({
      symbolicId: r.symbolicId || `$relationship:${r.id}`,
      displayName: r.displayName,
      processFlag: r.processFlag,
      cardinality: r.cardinality,
      sourceObjectTypeId: r.sourceObjectTypeId,
      targetObjectTypeId: r.targetObjectTypeId,
      sourceDisplayName: r.sourceDisplayName,
      targetDisplayName: r.targetDisplayName,
      junctionObjectTypeId: r.junctionObjectTypeId,
      propertyName: r.propertyName,
      config: r.config,
    })),
    actions: actions.map(a => ({
      symbolicId: a.symbolicId || `$action:${a.id}`,
      displayName: a.displayName,
      processFlag: a.processFlag,
      config: a.config,
    })),
    processLayouts: layouts.map(l => ({
      symbolicId: l.symbolicId || `$process:${l.id}`,
      processName: l.processName,
      processFlag: l.processFlag,
      objectTypeIds: l.objectTypeIds,
      trackedPicklists: l.trackedPicklists,
      layoutData: l.layoutData,
    })),
  };
}
