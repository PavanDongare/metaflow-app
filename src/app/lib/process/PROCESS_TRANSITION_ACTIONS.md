# Process Canvas: Auto-Generate Transition Actions

## Feature Overview

When users connect two state nodes on the process canvas by drawing an edge, the system
automatically generates a complete action definition with:
- A descriptive display name (e.g., "Pending -> Approved")
- Submission criteria that checks the current state
- A modify rule that changes the state to the target value

This eliminates the need to manually create actions through the full action builder form
for simple state transitions.

---

## Visual Flow

```
                          USER ACTION
                              |
                              v
    ┌─────────────────────────────────────────────────────────────────────┐
    |                     PROCESS CANVAS                                   |
    |                                                                      |
    |    ╭───────────╮                            ╭───────────╮           |
    |    │  Pending  │ ─────── drag edge ───────> │ Approved  │           |
    |    ╰───────────╯                            ╰───────────╯           |
    |         |                                        |                   |
    |         |                                        |                   |
    |    source node                             target node               |
    |    id: "state::Order::Pending"             id: "state::Order::Approved"
    |                                                                      |
    └─────────────────────────────────────────────────────────────────────┘
                              |
                              v
    ┌─────────────────────────────────────────────────────────────────────┐
    │                     Create Transition                                │
    │                                                                      │
    │         ╭─────────╮       →       ╭─────────╮                       │
    │         │ Pending │               │Approved │                       │
    │         ╰─────────╯               ╰─────────╯                       │
    │                                                                      │
    │              [ Pending → Approved        ]  (editable)              │
    │                                                                      │
    │                              [Cancel]  [Create]                      │
    └─────────────────────────────────────────────────────────────────────┘
                              |
                              v
    ┌─────────────────────────────────────────────────────────────────────┐
    │              ACTION CREATED & GRAPH UPDATED                          │
    │                                                                      │
    │    ╭───────────╮    ┌──────────────────┐    ╭───────────╮           │
    │    │  Pending  │───>│ Pending->Approved │───>│ Approved  │          │
    │    ╰───────────╯    └──────────────────┘    ╰───────────╯           │
    │                                                                      │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                        │
└──────────────────────────────────────────────────────────────────────────────┘

   React Flow onConnect
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  connection = {                                                           │
   │    source: "state::Order::Pending",                                       │
   │    target: "state::Order::Approved"                                       │
   │  }                                                                        │
   └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────┐     ┌──────────────────┐
   │ isStateNode(src) │────>│ isStateNode(tgt) │
   │   ✓ true         │     │   ✓ true         │
   └──────────────────┘     └──────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  sourceNode.data = {                    targetNode.data = {              │
   │    objectTypeId: "uuid-1234",             objectTypeId: "uuid-1234",     │
   │    objectTypeName: "Order",               objectTypeName: "Order",       │
   │    stateProperty: "status",               stateProperty: "status",       │
   │    stateValue: "Pending"                  stateValue: "Approved"         │
   │  }                                      }                                 │
   └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  validateTransition()                                                     │
   │    ✓ Same object type                                                     │
   │    ✓ Same state property                                                  │
   │    ✓ Different state values                                               │
   └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  TransitionActionModal (shows for user confirmation)                      │
   └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  generateTransitionAction() produces:                                     │
   │  {                                                                        │
   │    displayName: "Pending -> Approved",                                    │
   │    config: {                                                              │
   │      executionType: "declarative",                                        │
   │      parameters: [{                                                       │
   │        name: "order",                                                     │
   │        type: "object-reference",                                          │
   │        objectTypeId: "uuid-1234"                                          │
   │      }],                                                                  │
   │      submissionCriteria: [{                                               │
   │        type: "cmp",                                                       │
   │        left: { t: "prop", p: { param: "order", path: [], prop: "status" }},│
   │        op: "=",                                                           │
   │        right: { t: "val", v: "Pending" }                                  │
   │      }],                                                                  │
   │      rules: [{                                                            │
   │        type: "modify_object",                                             │
   │        objectParameter: "order",                                          │
   │        properties: {                                                      │
   │          status: { source: "static", value: "Approved" }                  │
   │        }                                                                  │
   │      }]                                                                   │
   │    }                                                                      │
   │  }                                                                        │
   └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  createActionType(tenantId, { displayName, config })                      │
   │    └─> INSERT INTO metaflow.action_types                                  │
   └──────────────────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  refetchActions()                                                         │
   │    └─> Graph rebuilds with new action node + edges                        │
   └──────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
metaflow/
├── processes/
│   └── [id]/
│       └── page.tsx                    # Main canvas page (handles onConnect)
│
├── components/process/
│   ├── ProcessCanvas.tsx               # React Flow wrapper
│   ├── StateNode.tsx                   # Oval state nodes with handles
│   ├── ActionNode.tsx                  # Rectangle action nodes
│   ├── ActionEdge.tsx                  # Labeled edges
│   └── TransitionActionModal.tsx       # [NEW] Modal for confirming auto-action
│
└── lib/process/
    ├── stateNodeGenerator.ts           # Generates state nodes from picklists
    ├── actionClassifier.ts             # Classifies actions as transitions
    ├── layoutCalculator.ts             # Auto-positions nodes (BFS/elkjs)
    ├── transitionActionGenerator.ts    # [NEW] Generates action config from states
    └── PROCESS_TRANSITION_ACTIONS.md   # [NEW] This documentation
```

---

## Key Functions

### `transitionActionGenerator.ts`

```typescript
// Build input from state node data
buildTransitionInput(sourceData: StateNodeData, targetData: StateNodeData): TransitionActionInput

// Generate complete action config
generateTransitionAction(input: TransitionActionInput): GeneratedTransitionAction

// Validate transition is allowed
validateTransition(sourceData: StateNodeData, targetData: StateNodeData): { valid: boolean; error?: string }
```

### `page.tsx` (Process Canvas)

```typescript
// Intercepts React Flow connection events
handleConnect(connection: Connection)
  -> Validates both endpoints are state nodes
  -> Validates transition (same object type, same property, different values)
  -> Opens TransitionActionModal

// Creates action after user confirms
handleCreateTransitionAction(displayName: string, config: ActionTypeConfig)
  -> Calls createActionType API
  -> Refetches actions to update graph
```

---

## Validation Rules

| Rule | Description | Error Message |
|------|-------------|---------------|
| Same Object Type | Source and target must be from the same object type | "Cross-object transitions not supported..." |
| Same State Property | Must be transitioning on the same property | "Cannot transition between different properties..." |
| Different Values | Cannot transition from a state to itself | "Cannot transition from a state to itself..." |

---

## Generated Action Structure

When connecting "Pending" to "Approved" on the Order object's "status" property:

```json
{
  "displayName": "Pending -> Approved",
  "config": {
    "executionType": "declarative",
    "description": "Transitions Order from \"Pending\" to \"Approved\"",
    "parameters": [
      {
        "name": "order",
        "type": "object-reference",
        "displayName": "Order",
        "required": true,
        "objectTypeId": "<order-type-uuid>"
      }
    ],
    "submissionCriteria": [
      {
        "type": "cmp",
        "left": {
          "t": "prop",
          "p": {
            "param": "order",
            "path": [],
            "prop": "status"
          }
        },
        "op": "=",
        "right": {
          "t": "val",
          "v": "Pending"
        }
      }
    ],
    "rules": [
      {
        "type": "modify_object",
        "objectParameter": "order",
        "properties": {
          "status": {
            "source": "static",
            "value": "Approved"
          }
        }
      }
    ]
  }
}
```

---

## Edge Cases Handled

1. **Non-state connections**: Silently ignored (e.g., action-to-action edges)
2. **Cross-object connections**: Shows error alert, connection rejected
3. **Different properties**: Shows error alert (e.g., "status" to "priority")
4. **Self-loops**: Shows error alert (cannot transition Pending -> Pending)
5. **Duplicate transitions**: Allowed (creates new action, classifier handles display)

---

## Future Enhancements

- [ ] Add toast notifications instead of browser alerts
- [ ] Support cross-object transitions with relationship traversal
- [ ] Add "quick edit" mode for created actions
- [ ] Show preview of existing similar actions before creating
- [ ] Support batch creation of multiple transitions at once
