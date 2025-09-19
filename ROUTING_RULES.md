# 🛤️ Wayfinding Routing Rules

## Overview

The wayfinding system enforces strict routing rules to ensure proper indoor navigation. These rules guarantee that all travelers follow designated pathways and that fixture-to-fixture routing uses the established waypoint network.

## Core Routing Rules

### ✅ **Allowed Connections**

| From Type | To Type | Status | Description |
|-----------|---------|---------|-------------|
| **Waypoint** | **Waypoint** | ✅ **ALLOWED** | Direct travel within navigation grid |
| **Fixture** | **Waypoint** | ✅ **ALLOWED** | Access from fixture to navigation grid |
| **Waypoint** | **Fixture** | ✅ **ALLOWED** | Access from navigation grid to fixture |

### ❌ **Forbidden Connections**

| From Type | To Type | Status | Description |
|-----------|---------|---------|-------------|
| **Fixture** | **Fixture** | ❌ **FORBIDDEN** | Must route through waypoint intermediaries |

## Node Types

- **Waypoints**: Navigation grid points (`wp_001`, `wp_025`, etc.)
- **Fixtures**: Physical objects/destinations
  - **DI Boxes**: `di_27_18_top`, `di_05_01_bottom`
  - **Cabinets**: `col_1_cab_01`, `col_2_cab_15`
  - **Fossils**: `fossil_excavation_1`, `fossil_site_2`

## Implementation Details

### Routing Constraint Function

The `_canVisitNeighbor()` function enforces these rules:

```javascript
_canVisitNeighbor(currentType, neighborType, allowDirectFixtureConnections) {
    // ✅ Waypoint → Waypoint: Direct navigation grid travel
    if (currentType === NODE_TYPES.WAYPOINT && neighborType === NODE_TYPES.WAYPOINT) {
        return true;
    }

    // ✅ Fixture → Waypoint: Access to navigation grid
    if (this._isFixtureType(currentType) && neighborType === NODE_TYPES.WAYPOINT) {
        return true;
    }

    // ✅ Waypoint → Fixture: Access from navigation grid
    if (currentType === NODE_TYPES.WAYPOINT && this._isFixtureType(neighborType)) {
        return true;
    }

    // ❌ Fixture → Fixture: NEVER allowed (enforced rule)
    if (this._isFixtureType(currentType) && this._isFixtureType(neighborType)) {
        return false; // Always force through waypoints
    }

    return false;
}
```

### Constraint Application Order

**Critical**: Routing constraints are applied **before** checking if the target is reached:

```javascript
// 1. Check routing constraints FIRST
if (!this._canVisitNeighbor(currentNodeType, neighborType, allowDirectFixtureConnections)) {
    continue; // Skip forbidden connections
}

// 2. THEN check if target is reached
if (neighbor === targetId) {
    return newPath; // Only if routing allows it
}
```

This ensures that even direct graph connections between fixtures are ignored by the pathfinding algorithm.

## Example Routing Scenarios

### ✅ Valid Routing Examples

```javascript
// Waypoint to waypoint (navigation grid travel through intermediate waypoints)
pathfinder.findPath('wp_001', 'wp_025')
// Result: ['wp_001', 'wp_002', 'wp_005', 'wp_010', 'wp_015', 'wp_020', 'wp_025']

// Fixture to waypoint (access navigation grid)
pathfinder.findPath('di_box_1', 'wp_001') 
// Result: ['di_box_1', 'wp_001']

// Waypoint to fixture (access fixture from grid)
pathfinder.findPath('wp_025', 'cabinet_1')
// Result: ['wp_025', 'cabinet_1']

// Fixture to fixture (ENFORCED routing through waypoint network)
pathfinder.findPath('di_box_1', 'cabinet_1')
// Result: ['di_box_1', 'wp_001', 'wp_002', 'wp_005', 'wp_010', 'wp_015', 'wp_020', 'wp_025', 'cabinet_1']
```

### 🛤️ Enforced Waypoint Routing Examples

```javascript
// Direct fixture connection exists in graph but is ignored by routing rules
graph.addEdge('di_box_1', 'cabinet_1'); // Physical connection exists but ignored
graph.addEdge('di_box_1', 'wp_001');    // Fixture connects to waypoint network
graph.addEdge('wp_025', 'cabinet_1');   // Waypoint network connects to target fixture

pathfinder.findPath('di_box_1', 'cabinet_1')
// Result: ['di_box_1', 'wp_001', 'wp_002', 'wp_005', 'wp_010', 'wp_015', 'wp_020', 'wp_025', 'cabinet_1'] (through waypoints)
// The direct di_box_1 → cabinet_1 edge is ignored by routing constraints

// The allowDirectFixtureConnections flag is ignored for fixtures
pathfinder.findPath('di_box_1', 'cabinet_1', { allowDirectFixtureConnections: true })
// Result: ['di_box_1', 'wp_001', 'wp_002', 'wp_005', 'wp_010', 'wp_015', 'wp_020', 'wp_025', 'cabinet_1'] (still through waypoints)

// Only returns null if no waypoint path exists
pathfinder.findPath('isolated_fixture_1', 'isolated_fixture_2')
// Result: null (only if fixtures are not connected to waypoint network)
```

## Design Rationale

### 🎯 **Why These Rules?**

1. **Safety Compliance**: Ensures travelers follow designated, safe pathways
2. **Accessibility**: Waypoints can be optimized for accessibility requirements
3. **Maintenance**: Changes to navigation flow only require waypoint network updates
4. **Consistency**: All fixture-to-fixture routing uses the same established grid
5. **Emergency Planning**: Clear, predictable routing for emergency procedures

### 🏗️ **Network Architecture**

```
Fixtures (Endpoints)     Waypoint Grid (Network)     Fixtures (Endpoints)
       |                         |                         |
   [di_box_1] ←→ [wp_001] ←→ [wp_002] ←→ [wp_003] ←→ [cabinet_1]
       |              |         |         |              |
   [fossil_1] ←→ [wp_004] ←→ [wp_005] ←→ [wp_006] ←→ [cabinet_2]
       |              |         |         |              |
```

- **Fixtures** are endpoints that connect to the grid
- **Waypoints** form the interconnected navigation network
- **All fixture-to-fixture travel** must use the waypoint network

## Testing

The routing rules are thoroughly tested to ensure:

- ✅ Direct fixture-to-fixture connections are never allowed
- ✅ Waypoint-to-waypoint connections work directly
- ✅ Fixture-waypoint connections work in both directions
- ✅ Multiple path finding works best for waypoint-to-waypoint routes
- ✅ The `allowDirectFixtureConnections` flag is ignored for fixtures

## Usage Guidelines

### For Developers

1. **Always test routing rules** when adding new node types
2. **Waypoints should form a connected network** for accessibility
3. **Fixtures should connect to nearby waypoints** for optimal routing
4. **Consider accessibility** when placing waypoints

### For Data Creators

1. **Design waypoint networks first** before placing fixtures
2. **Ensure waypoint connectivity** for all areas
3. **Connect fixtures to logical waypoint access points**
4. **Test end-to-end routing** for critical fixture pairs

---

**This document captures the enforced routing logic that ensures proper indoor navigation through designated pathways.**
