// Process Canvas Page - Visual workflow builder

'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Node, Edge, Connection, MarkerType } from 'reactflow';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProcessLayout } from '../../lib/hooks/use-process';
import { useObjectTypes } from '../../lib/hooks/use-ontology';
import { useActionTypes } from '../../lib/hooks/use-actions';
import ProcessCanvas from '../../components/process/ProcessCanvas';
import PicklistManager from '../../components/process/PicklistManager';
import { generateStateNodes, isStateNode } from '../../lib/process/stateNodeGenerator';
import { classifyAction } from '../../lib/process/actionClassifier';
import { applyLayout, calculateLayout } from '../../lib/process/layoutCalculator';
import { validateTransition } from '../../lib/process/transitionActionGenerator';
import TransitionActionModal from '../../components/process/TransitionActionModal';
import { createActionType } from '../../lib/hooks/use-actions';
import { useTenant } from '@/lib/auth/tenant-context';
import type { StateNodeData } from '../../lib/process/stateNodeGenerator';
import { DesktopRecommended } from '@/components/desktop-recommended';

export default function ProcessCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: processId } = use(params);

  const {
    layout,
    loading: layoutLoading,
    save: saveLayout,
    addTrackedPicklist,
    removeTrackedPicklist,
  } = useProcessLayout(processId);
  const { objectTypes, loading: ontologyLoading } = useObjectTypes();
  const { actionTypes, loading: actionsLoading, refetch: refetchActions } = useActionTypes();
  const { tenantId } = useTenant();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Transition action modal state
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    sourceState: StateNodeData;
    targetState: StateNodeData;
  } | null>(null);

  // Load and build graph
  useEffect(() => {
    if (layoutLoading || ontologyLoading || actionsLoading || !layout) return;

    const buildGraph = async () => {
      // 1. Filter object types for this process
      const processObjectTypes = objectTypes.filter((ot) =>
        layout.objectTypeIds.includes(ot.id)
      );

      // 2. Generate state nodes from tracked picklists
      const trackedPicklists = layout.trackedPicklists || [];
      const stateNodes = generateStateNodes(processObjectTypes, trackedPicklists);

      // 3. Filter actions for these object types
      const processActions = actionTypes.filter((action) => {
        const config = action.config;
        const params = config.parameters || [];

        // Check parameters for object-reference types
        const hasMatchingParam = params.some(
          (param) =>
            param.type === 'object-reference' &&
            param.objectTypeId &&
            layout.objectTypeIds.includes(param.objectTypeId)
        );
        if (hasMatchingParam) return true;

        // Check rules for matching object types
        const rules = config.rules || [];
        const hasMatchingRule = rules.some((rule) => {
          if (rule.type === 'create_object' && layout.objectTypeIds.includes(rule.objectTypeId)) {
            return true;
          }
          return false;
        });
        if (hasMatchingRule) return true;

        return false;
      });

      // 4. Classify actions and create edges/nodes
      const newEdges: Edge[] = [];
      const actionNodes: Node[] = [];

      for (const action of processActions) {
        const classification = classifyAction(action, processObjectTypes);

        if (classification.type === 'state_transition') {
          const hasFullTransition =
            classification.sourceNodeId && classification.targetNodeId;
          const hasPartialTransition =
            classification.hasSourceOnly || classification.hasTargetOnly;

          if (hasFullTransition) {
            const actionNodeId = `action::${action.id}`;

            actionNodes.push({
              id: actionNodeId,
              type: 'actionNode',
              position: { x: 0, y: 0 },
              data: {
                actionId: action.id,
                actionName: action.displayName,
                isOrphaned: false,
              },
            });

            newEdges.push({
              id: `${classification.sourceNodeId}-to-${actionNodeId}`,
              source: classification.sourceNodeId!,
              target: actionNodeId,
              type: 'actionEdge',
              data: {
                actionId: action.id,
                hasExtras: false,
              },
            });

            newEdges.push({
              id: `${actionNodeId}-to-${classification.targetNodeId}`,
              source: actionNodeId,
              target: classification.targetNodeId!,
              type: 'actionEdge',
              data: {
                actionId: action.id,
                hasExtras: false,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 24,
                height: 24,
                color: '#000000',
              },
            });
          } else if (hasPartialTransition) {
            const actionNodeId = `action::${action.id}`;
            actionNodes.push({
              id: actionNodeId,
              type: 'actionNode',
              position: { x: 0, y: 0 },
              data: {
                actionId: action.id,
                actionName: action.displayName,
                isOrphaned: false,
              },
            });

            if (classification.sourceNodeId) {
              newEdges.push({
                id: `${classification.sourceNodeId}-to-${actionNodeId}`,
                source: classification.sourceNodeId,
                target: actionNodeId,
                type: 'actionEdge',
                data: {
                  actionId: action.id,
                  actionName: action.displayName,
                  hasExtras: false,
                },
              });
            }

            if (classification.targetNodeId) {
              newEdges.push({
                id: `${actionNodeId}-to-${classification.targetNodeId}`,
                source: actionNodeId,
                target: classification.targetNodeId,
                type: 'actionEdge',
                data: {
                  actionId: action.id,
                  actionName: action.displayName,
                  hasExtras: false,
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 24,
                  height: 24,
                  color: '#000000',
                },
              });
            }
          }
        } else if (classification.type === 'orphaned') {
          actionNodes.push({
            id: `action::${action.id}`,
            type: 'actionNode',
            position: { x: 0, y: 0 },
            data: {
              actionId: action.id,
              actionName: action.displayName,
              isOrphaned: true,
              orphanReason: classification.reason,
            },
          });
        } else {
          actionNodes.push({
            id: `action::${action.id}`,
            type: 'actionNode',
            position: { x: 0, y: 0 },
            data: {
              actionId: action.id,
              actionName: action.displayName,
              isOrphaned: false,
            },
          });
        }
      }

      // 5. Combine all nodes
      const allNodes = [...stateNodes, ...actionNodes];

      // 6. Apply saved layout or calculate new one
      const layoutData = (layout.layoutData as Record<string, { x: number; y: number }>) || {};
      const hasLayoutData = Object.keys(layoutData).length > 0;

      let positionedNodes: Node[];
      let positionedEdges: Edge[];

      if (hasLayoutData) {
        const result = await applyLayout(allNodes, newEdges, layoutData);
        positionedNodes = result.nodes;
        positionedEdges = result.edges;
      } else {
        const result = await calculateLayout(allNodes, newEdges);
        positionedNodes = result.nodes;
        positionedEdges = result.edges;
      }

      // Reposition orphaned actions to corner
      const orphanedNodes = positionedNodes.filter(
        (n) => n.type === 'actionNode' && n.data?.isOrphaned
      );

      if (orphanedNodes.length > 0 && !hasLayoutData) {
        let orphanY = 50;
        orphanedNodes.forEach((node) => {
          node.position = { x: 800, y: orphanY };
          orphanY += 120;
        });
      }

      setNodes(positionedNodes);
      setEdges(positionedEdges);
      setIsInitialized(true);
    };

    buildGraph();
  }, [
    layout?.id,
    layout?.objectTypeIds?.join(','),
    layout?.trackedPicklists?.join(','),
    objectTypes,
    actionTypes,
    layoutLoading,
    ontologyLoading,
    actionsLoading,
  ]);

  // Handle node position changes
  const handleNodesChange = useCallback((updatedNodes: Node[]) => {
    setNodes(updatedNodes);
  }, []);

  // Manual save layout handler
  const handleSaveLayout = useCallback(() => {
    const layoutData: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node) => {
      layoutData[node.id] = { x: node.position.x, y: node.position.y };
    });
    saveLayout(layoutData);
  }, [nodes, saveLayout]);

  // Handle edge changes
  const handleEdgesChange = useCallback((updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
  }, []);

  // Handle new connection - intercept state-to-state for auto action creation
  const handleConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;

      // Check if both source and target are state nodes
      if (!isStateNode(source) || !isStateNode(target)) {
        return; // Not a state-to-state connection
      }

      // Get state data from nodes
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);

      if (!sourceNode || !targetNode) return;

      const sourceData = sourceNode.data as StateNodeData;
      const targetData = targetNode.data as StateNodeData;

      // Validate the transition
      const validation = validateTransition(sourceData, targetData);
      if (!validation.valid) {
        alert(`Invalid Transition: ${validation.error}`);
        return;
      }

      // Open modal for confirmation
      setPendingTransition({ sourceState: sourceData, targetState: targetData });
      setTransitionModalOpen(true);
    },
    [nodes]
  );

  // Handle action creation from transition modal
  const handleCreateTransitionAction = useCallback(
    async (displayName: string, config: any) => {
      await createActionType(tenantId, { displayName, config });
      // Refetch actions to update the graph
      await refetchActions();
    },
    [tenantId, refetchActions]
  );

  if (layoutLoading || ontologyLoading || actionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-muted-foreground mb-4">Process not found</p>
        <Button onClick={() => router.push('/processes')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Processes
        </Button>
      </div>
    );
  }

  const processObjectTypes = objectTypes.filter((ot) =>
    layout.objectTypeIds.includes(ot.id)
  );

  return (
    <DesktopRecommended featureName="Process Canvas">
      <div className="flex h-full">
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-card px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/processes')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {layout.processName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {layout.objectTypeIds.length} object type
                  {layout.objectTypeIds.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button variant="default" size="sm" onClick={handleSaveLayout}>
              <Save className="w-4 h-4 mr-2" />
              Save Layout
            </Button>
          </div>

          {/* Canvas */}
          <div className="flex-1">
            {isInitialized && (
              <ProcessCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
              />
            )}
          </div>
        </div>

        {/* Picklist Manager Sidebar */}
        <PicklistManager
          objectTypes={processObjectTypes}
          trackedPicklists={layout.trackedPicklists || []}
          onAddPicklist={addTrackedPicklist}
          onRemovePicklist={removeTrackedPicklist}
        />

        {/* Transition Action Modal */}
        <TransitionActionModal
          open={transitionModalOpen}
          onOpenChange={setTransitionModalOpen}
          sourceState={pendingTransition?.sourceState ?? null}
          targetState={pendingTransition?.targetState ?? null}
          onConfirm={handleCreateTransitionAction}
        />
      </div>
    </DesktopRecommended>
  );
}
