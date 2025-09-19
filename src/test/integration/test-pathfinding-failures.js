#!/usr/bin/env node

/**
 * Pathfinding Failure Analysis Script
 * 
 * This script investigates why pathfinding fails between clearly connected components.
 * It will test specific cases where paths should exist but don't.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function analyzePathfindingFailures() {
    console.log(`🔍 Analyzing pathfinding failures...`);
    
    try {
        // Read files directly since we're in Node.js
        const fs = await import('fs');
        
        const wayfindingPath = join(__dirname, '..', '..', '..', 'public', 'geojson', 'wayfinding.geojson');
        const fixturePaths = [
            join(__dirname, '..', '..', '..', 'public', 'geojson', 'cabinet_fixtures.geojson'),
            join(__dirname, '..', '..', '..', 'public', 'geojson', 'di_box_fixtures.geojson'),
            join(__dirname, '..', '..', '..', 'public', 'geojson', 'fossil_excavation_fixtures.geojson')
        ];
        
        // Read and parse GeoJSON files
        console.log(`📖 Reading wayfinding.geojson...`);
        const wayfindingData = JSON.parse(fs.readFileSync(wayfindingPath, 'utf8'));
        
        console.log(`📖 Reading fixture files...`);
        const fixtureData = [];
        for (const fixturePath of fixturePaths) {
            const data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
            fixtureData.push(data);
        }
        
        // Build graph using the GraphBuilder directly
        const { GraphBuilder } = await import('../../data/loader.js');
        const { Pathfinder, NODE_TYPES } = await import('../../core/pathfinding.js');
        
        const builder = new GraphBuilder();
        const graph = builder.buildGraph(wayfindingData, fixtureData);
        const pathfinder = new Pathfinder(graph);
        
        console.log(`✅ Graph loaded successfully!`);
        console.log(`📊 Graph statistics:`, graph.getStatistics());
        
        // Test specific cases where pathfinding might fail
        console.log(`\n🧪 Testing specific pathfinding cases:`);
        
        // Get some sample fixtures from each type
        const allNodes = Array.from(graph.nodes);
        const fossils = allNodes.filter(node => graph.getNodeType(node) === NODE_TYPES.FOSSIL);
        const diBoxes = allNodes.filter(node => graph.getNodeType(node) === NODE_TYPES.DI_BOX);
        const waypoints = allNodes.filter(node => graph.getNodeType(node) === NODE_TYPES.WAYPOINT);
        
        console.log(`   Fossils: ${fossils.length}, DI boxes: ${diBoxes.length}, Waypoints: ${waypoints.length}`);
        
        // Test 1: Fossil to DI box (should work)
        console.log(`\n📍 Test 1: Fossil to DI box paths`);
        let fossilToDiTests = 0;
        let fossilToDiSuccess = 0;
        const fossilToDiFailures = [];
        
        for (let i = 0; i < Math.min(3, fossils.length); i++) {
            for (let j = 0; j < Math.min(5, diBoxes.length); j++) {
                const from = fossils[i];
                const to = diBoxes[j];
                fossilToDiTests++;
                
                const path = pathfinder.findPath(from, to);
                if (path) {
                    fossilToDiSuccess++;
                } else {
                    fossilToDiFailures.push({ from, to });
                }
            }
        }
        
        console.log(`   Results: ${fossilToDiSuccess}/${fossilToDiTests} successful`);
        if (fossilToDiFailures.length > 0) {
            console.log(`   Failed cases:`);
            fossilToDiFailures.slice(0, 5).forEach(({ from, to }) => {
                console.log(`      ${from} → ${to}`);
            });
        }
        
        // Test 2: Check if failed cases are actually disconnected
        console.log(`\n📍 Test 2: Analyzing failed cases`);
        
        if (fossilToDiFailures.length > 0) {
            const { from, to } = fossilToDiFailures[0];
            console.log(`   Analyzing: ${from} → ${to}`);
            
            // Check if nodes exist
            console.log(`      ${from} exists: ${graph.hasNode(from)}`);
            console.log(`      ${to} exists: ${graph.hasNode(to)}`);
            
            if (graph.hasNode(from) && graph.hasNode(to)) {
                // Check connectivity manually using BFS
                console.log(`      Manual BFS connectivity check:`);
                
                const queue = [from];
                const visited = new Set([from]);
                const parent = new Map();
                let found = false;
                let targetNode = null;
                
                while (queue.length > 0 && !found) {
                    const current = queue.shift();
                    
                    for (const neighbor of graph.getNeighbors(current)) {
                        if (visited.has(neighbor)) continue;
                        
                        visited.add(neighbor);
                        parent.set(neighbor, current);
                        queue.push(neighbor);
                        
                        if (neighbor === to) {
                            found = true;
                            targetNode = neighbor;
                            break;
                        }
                    }
                }
                
                console.log(`      Manual BFS found path: ${found}`);
                
                if (found) {
                    // Reconstruct path
                    const path = [];
                    let node = targetNode;
                    while (node) {
                        path.unshift(node);
                        node = parent.get(node);
                    }
                    console.log(`      Manual BFS path: [${path.join(' → ')}]`);
                    console.log(`      Path length: ${path.length}`);
                    
                    // Check each step for routing constraints
                    console.log(`      Checking routing constraints:`);
                    for (let i = 0; i < path.length - 1; i++) {
                        const current = path[i];
                        const next = path[i + 1];
                        const currentType = graph.getNodeType(current);
                        const nextType = graph.getNodeType(next);
                        
                        // Apply the same routing constraints as the pathfinder
                        const canVisit = pathfinder._canVisitNeighbor(currentType, nextType, false);
                        console.log(`         ${current} (${currentType}) → ${next} (${nextType}): ${canVisit ? 'ALLOWED' : 'BLOCKED'}`);
                        
                        if (!canVisit) {
                            console.log(`         ❌ This step violates routing constraints!`);
                        }
                    }
                } else {
                    console.log(`      Manual BFS could not find path - nodes are truly disconnected`);
                }
            }
        }
        
        // Test 3: Test with different pathfinding options
        console.log(`\n📍 Test 3: Testing with different pathfinding options`);
        
        if (fossilToDiFailures.length > 0) {
            const { from, to } = fossilToDiFailures[0];
            console.log(`   Testing: ${from} → ${to}`);
            
            // Test with different maxDepth values
            const depthTests = [10, 50, 100, 200, 500, 1000];
            for (const maxDepth of depthTests) {
                const path = pathfinder.findPath(from, to, { maxDepth });
                console.log(`      Max depth ${maxDepth}: ${path ? `Found (${path.length} nodes)` : 'Not found'}`);
                
                if (path) {
                    console.log(`         Path: [${path.join(' → ')}]`);
                    break;
                }
            }
            
            // Test with allowDirectFixtureConnections
            console.log(`   Testing with allowDirectFixtureConnections=true:`);
            const pathWithDirect = pathfinder.findPath(from, to, { allowDirectFixtureConnections: true });
            console.log(`      Result: ${pathWithDirect ? `Found (${pathWithDirect.length} nodes)` : 'Not found'}`);
        }
        
        // Test 4: Check for routing constraint issues
        console.log(`\n📍 Test 4: Checking routing constraints`);
        
        // Test the _canVisitNeighbor method directly
        const constraintTests = [
            { from: NODE_TYPES.FOSSIL, to: NODE_TYPES.WAYPOINT, description: 'Fossil → Waypoint' },
            { from: NODE_TYPES.WAYPOINT, to: NODE_TYPES.FOSSIL, description: 'Waypoint → Fossil' },
            { from: NODE_TYPES.WAYPOINT, to: NODE_TYPES.WAYPOINT, description: 'Waypoint → Waypoint' },
            { from: NODE_TYPES.DI_BOX, to: NODE_TYPES.WAYPOINT, description: 'DI Box → Waypoint' },
            { from: NODE_TYPES.WAYPOINT, to: NODE_TYPES.DI_BOX, description: 'Waypoint → DI Box' },
            { from: NODE_TYPES.FOSSIL, to: NODE_TYPES.DI_BOX, description: 'Fossil → DI Box' },
            { from: NODE_TYPES.DI_BOX, to: NODE_TYPES.FOSSIL, description: 'DI Box → Fossil' }
        ];
        
        console.log(`   Routing constraint tests:`);
        constraintTests.forEach(({ from, to, description }) => {
            const allowed = pathfinder._canVisitNeighbor(from, to, false);
            const allowedWithDirect = pathfinder._canVisitNeighbor(from, to, true);
            console.log(`      ${description}: ${allowed ? 'ALLOWED' : 'BLOCKED'} (direct: ${allowedWithDirect ? 'ALLOWED' : 'BLOCKED'})`);
        });
        
        // Test 5: Check for specific problematic nodes
        console.log(`\n📍 Test 5: Checking for problematic nodes`);
        
        // Find nodes with no neighbors
        const isolatedNodes = allNodes.filter(node => {
            const neighbors = Array.from(graph.getNeighbors(node));
            return neighbors.length === 0;
        });
        
        if (isolatedNodes.length > 0) {
            console.log(`   Found ${isolatedNodes.length} isolated nodes (no neighbors):`);
            isolatedNodes.slice(0, 10).forEach(node => {
                const nodeType = graph.getNodeType(node);
                console.log(`      ${node} (${nodeType})`);
            });
        }
        
        // Find nodes with only fixture neighbors (no waypoint connections)
        const fixtureOnlyNodes = allNodes.filter(node => {
            const neighbors = Array.from(graph.getNeighbors(node));
            if (neighbors.length === 0) return false;
            
            const hasWaypointNeighbor = neighbors.some(neighbor => 
                graph.getNodeType(neighbor) === NODE_TYPES.WAYPOINT
            );
            return !hasWaypointNeighbor;
        });
        
        if (fixtureOnlyNodes.length > 0) {
            console.log(`   Found ${fixtureOnlyNodes.length} nodes with no waypoint connections:`);
            fixtureOnlyNodes.slice(0, 10).forEach(node => {
                const nodeType = graph.getNodeType(node);
                const neighbors = Array.from(graph.getNeighbors(node));
                console.log(`      ${node} (${nodeType}) - neighbors: [${neighbors.slice(0, 3).join(', ')}${neighbors.length > 3 ? '...' : ''}]`);
            });
        }
        
    } catch (error) {
        console.error(`❌ Error during pathfinding failure analysis:`, error);
        throw error;
    }
}

// Run the analysis
analyzePathfindingFailures().catch(console.error);
