#!/usr/bin/env node

/**
 * Specific Pathfinding Failure Investigation
 * 
 * This script investigates specific cases where pathfinding should work but doesn't.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function investigateSpecificFailures() {
    console.log(`🔍 Investigating specific pathfinding failures...`);
    
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
        
        // Test a comprehensive set of fossil-to-DI box combinations
        console.log(`\n🧪 Testing comprehensive fossil-to-DI box pathfinding:`);
        
        const fossils = ['fossil_excavation_1', 'fossil_excavation_2', 'fossil_excavation_3', 'fossil_excavation_4', 'fossil_excavation_5'];
        const diBoxes = ['di_05_01_top', 'di_05_02_top', 'di_06_01_top', 'di_11_04_top', 'di_12_04_top'];
        
        let totalTests = 0;
        let successfulPaths = 0;
        const failedPaths = [];
        
        for (const fossil of fossils) {
            for (const diBox of diBoxes) {
                totalTests++;
                
                if (!graph.hasNode(fossil) || !graph.hasNode(diBox)) {
                    console.log(`   ❌ Missing nodes: ${fossil} (${graph.hasNode(fossil)}), ${diBox} (${graph.hasNode(diBox)})`);
                    continue;
                }
                
                const path = pathfinder.findPath(fossil, diBox);
                
                if (path) {
                    successfulPaths++;
                    console.log(`   ✅ ${fossil} → ${diBox}: [${path.join(' → ')}] (${path.length} nodes)`);
                } else {
                    failedPaths.push({ from: fossil, to: diBox });
                    console.log(`   ❌ ${fossil} → ${diBox}: No path found`);
                    
                    // Investigate why this path failed
                    console.log(`      Investigating failure...`);
                    
                    // Check if both nodes are connected to waypoints
                    const fossilNeighbors = Array.from(graph.getNeighbors(fossil));
                    const diBoxNeighbors = Array.from(graph.getNeighbors(diBox));
                    
                    const fossilWaypointNeighbors = fossilNeighbors.filter(n => graph.getNodeType(n) === NODE_TYPES.WAYPOINT);
                    const diBoxWaypointNeighbors = diBoxNeighbors.filter(n => graph.getNodeType(n) === NODE_TYPES.WAYPOINT);
                    
                    console.log(`         ${fossil} waypoint neighbors: [${fossilWaypointNeighbors.join(', ')}]`);
                    console.log(`         ${diBox} waypoint neighbors: [${diBoxWaypointNeighbors.join(', ')}]`);
                    
                    // Check if there's a path between any of their waypoint neighbors
                    let foundWaypointPath = false;
                    for (const fossilWp of fossilWaypointNeighbors) {
                        for (const diBoxWp of diBoxWaypointNeighbors) {
                            const waypointPath = pathfinder.findPath(fossilWp, diBoxWp);
                            if (waypointPath) {
                                console.log(`         ✅ Waypoint path found: ${fossilWp} → ${diBoxWp}`);
                                console.log(`         Path: [${waypointPath.join(' → ')}]`);
                                foundWaypointPath = true;
                                break;
                            }
                        }
                        if (foundWaypointPath) break;
                    }
                    
                    if (!foundWaypointPath) {
                        console.log(`         ❌ No waypoint path found between connected waypoints`);
                    }
                }
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   Total tests: ${totalTests}`);
        console.log(`   Successful: ${successfulPaths}`);
        console.log(`   Failed: ${failedPaths.length}`);
        console.log(`   Success rate: ${(successfulPaths / totalTests * 100).toFixed(1)}%`);
        
        // Test with different pathfinding parameters
        if (failedPaths.length > 0) {
            console.log(`\n🔧 Testing failed paths with different parameters:`);
            
            const { from, to } = failedPaths[0];
            console.log(`   Testing: ${from} → ${to}`);
            
            // Test with different maxDepth values
            const depthTests = [5, 10, 20, 50, 100, 200, 500, 1000];
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
            if (pathWithDirect) {
                console.log(`         Path: [${pathWithDirect.join(' → ')}]`);
            }
        }
        
        // Test the BFS algorithm step by step
        if (failedPaths.length > 0) {
            console.log(`\n🔍 Step-by-step BFS analysis:`);
            
            const { from, to } = failedPaths[0];
            console.log(`   Analyzing: ${from} → ${to}`);
            
            // Manual BFS to see where it gets stuck
            const queue = [[from]];
            const visited = new Set([from]);
            let iterations = 0;
            const maxIterations = 50; // Limit for debugging
            
            console.log(`   Starting BFS...`);
            
            while (queue.length > 0 && iterations < maxIterations) {
                iterations++;
                const currentPath = queue.shift();
                const currentNode = currentPath[currentPath.length - 1];
                const currentNodeType = graph.getNodeType(currentNode);
                
                console.log(`      Iteration ${iterations}: Current node ${currentNode} (${currentNodeType}), path length: ${currentPath.length}`);
                
                const neighbors = Array.from(graph.getNeighbors(currentNode));
                console.log(`         Neighbors: [${neighbors.slice(0, 5).join(', ')}${neighbors.length > 5 ? '...' : ''}] (${neighbors.length} total)`);
                
                let validNeighbors = 0;
                
                for (const neighbor of neighbors) {
                    if (visited.has(neighbor)) {
                        console.log(`            ${neighbor}: already visited`);
                        continue;
                    }
                    
                    const neighborType = graph.getNodeType(neighbor);
                    
                    // Apply routing constraints
                    const canVisit = pathfinder._canVisitNeighbor(currentNodeType, neighborType, false);
                    
                    if (!canVisit) {
                        console.log(`            ${neighbor} (${neighborType}): BLOCKED by routing constraints`);
                        continue;
                    }
                    
                    validNeighbors++;
                    console.log(`            ${neighbor} (${neighborType}): ALLOWED`);
                    
                    const newPath = [...currentPath, neighbor];
                    
                    if (neighbor === to) {
                        console.log(`         🎯 TARGET FOUND! Path: [${newPath.join(' → ')}]`);
                        break;
                    }
                    
                    visited.add(neighbor);
                    queue.push(newPath);
                }
                
                console.log(`         Valid neighbors added: ${validNeighbors}`);
                
                if (iterations >= maxIterations) {
                    console.log(`         ⚠️  Reached iteration limit (${maxIterations})`);
                }
            }
            
            if (queue.length === 0) {
                console.log(`   ❌ BFS exhausted all possibilities without finding target`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error during specific failure investigation:`, error);
        throw error;
    }
}

// Run the investigation
investigateSpecificFailures().catch(console.error);
