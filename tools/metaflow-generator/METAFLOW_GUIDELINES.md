# MetaFlow Configuration Guidelines

Follow these rules to generate a valid, production-grade MetaFlow configuration.

## Core Process Model
1. **Pipeline Object**: Every app must have at least one primary "pipeline" object (e.g., $deal, $loan, $ticket).
2. **State Field**: The pipeline object MUST have a single-select picklist field for tracking state.
   - `type`: "string"
   - `picklistConfig.allowMultiple`: false
   - `picklistConfig.options`: A list of at least 2 states (e.g., ["New", "In Progress", "Closed"]).
3. **Transition Actions**: Actions that move an object between states MUST include:
   - **Submission Criteria**: A condition checking the current state (e.g., `status = 'New'`).
   - **Transition Rule**: A `modify_object` rule that sets the next state (e.g., `status = 'In Progress'`).

## Action Semantics
- **Parameters**: Define parameters for the objects or values the action operates on.
- **Rules**: Use rules to `create_object` or `modify_object`.
- **Submission Criteria**: Use as a guard to prevent actions from running in the wrong context.

## Relationship Semantics
- Use `MANY_TO_ONE` or `ONE_TO_MANY` for simple links.
- Use `MANY_TO_MANY` with a `junctionObjectTypeId` when the relationship itself needs attributes (e.g., a "Role" on a deal contact).

## Process Layout
- Every configuration must include a `processLayout` that references the pipeline object.
- The layout must track the state picklist field.
- The `stages` in the layout should match the picklist options.

## Symbolic IDs
- Use symbolic IDs (starting with `$`) for all entities (e.g., `$deal`, `$qualify_action`). These are resolved to UUIDs during deployment.

## Process Flagging
- **Mandatory Field**: Every object type, relationship, action, and process layout MUST include a `processFlag` string property.
- **Purpose**: This flag indicates which business process the element belongs to (e.g., "Sales", "Inventory", "HR").
- **Usage**: On the dashboard, this flag is used to filter and group elements, making large-scale ontologies manageable.
- **Format**: A short, kebab-case or PascalCase string (e.g., "CustomerSupport").
