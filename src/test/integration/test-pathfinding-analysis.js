#!/usr/bin/env node

/**
 * Pathfinding Analysis Script
 * 
 * This script analyzes the pathfinding behavior to understand why the algorithm
 * might not be working optimally for fixture-to-fixture navigation through waypoints.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function analyzePathfinding() {
    console.log(`🔍 Analyzing pathfinding behavior...`);
    
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
        
        // Test specific pathfinding scenarios
        console.log(`\n🧪 Testing pathfinding scenarios:`);
        
        // Test 1: Fossil to DI box path
        const testPaths = [
            { from: 'fossil_excavation_1', to: 'di_05_01_top', description: 'Fossil to DI box' },
            { from: 'fossil_excavation_8', to: 'di_27_18_top', description: 'Fossil to DI box (should be connected)' },
            { from: 'wp_126', to: 'wp_064', description: 'Waypoint to waypoint' },
            { from: 'fossil_excavation_8', to: 'wp_126', description: 'Fossil to connected waypoint' },
            { from: 'di_27_18_top', to: 'wp_064', description: 'DI box to connected waypoint' }
        ];
        
        for (const { from, to, description } of testPaths) {
            console.log(`\n📍 ${description}: ${from} → ${to}`);
            
            const fromExists = graph.hasNode(from);
            const toExists = graph.hasNode(to);
            
            if (!fromExists || !toExists) {
                console.log(`   ❌ Missing nodes: ${from} exists: ${fromExists}, ${to} exists: ${toExists}`);
                continue;
            }
            
            // Test pathfinding
            const path = pathfinder.findPath(from, to);
            
            if (path) {
                console.log(`   ✅ Path found: [${path.join(' → ')}]`);
                console.log(`   📏 Path length: ${path.length} nodes`);
                
                // Analyze path composition
                const waypointCount = path.filter(node => graph.getNodeType(node) === NODE_TYPES.WAYPOINT).length;
                const fixtureCount = path.filter(node => {
                    const type = graph.getNodeType(node);
                    return type === NODE_TYPES.DI_BOX || type === NODE_TYPES.FOSSIL || type === NODE_TYPES.CABINET;
                }).length;
                
                console.log(`   📊 Path composition: ${waypointCount} waypoints, ${fixtureCount} fixtures`);
                
                // Check if path follows expected pattern
                const expectedPattern = (graph.getNodeType(from) !== NODE_TYPES.WAYPOINT && 
                                       graph.getNodeType(to) !== NODE_TYPES.WAYPOINT);
                
                if (expectedPattern) {
                    // For fixture-to-fixture paths, should start with fixture, go through waypoints, end with fixture
                    const startsWithFixture = graph.getNodeType(path[0]) !== NODE_TYPES.WAYPOINT;
                    const endsWithFixture = graph.getNodeType(path[path.length - 1]) !== NODE_TYPES.WAYPOINT;
                    const hasWaypointsInMiddle = waypointCount > 0;
                    
                    console.log(`   🔍 Pattern analysis:`);
                    console.log(`      Starts with fixture: ${startsWithFixture}`);
                    console.log(`      Ends with fixture: ${endsWithFixture}`);
                    console.log(`      Has waypoints in middle: ${hasWaypointsInMiddle}`);
                    console.log(`      Follows expected pattern: ${startsWithFixture && endsWithFixture && hasWaypointsInMiddle}`);
                }
                
            } else {
                console.log(`   ❌ No path found`);
            }
        }
        
        // Analyze waypoint connectivity
        console.log(`\n🔗 Waypoint connectivity analysis:`);
        
        const waypoints = Array.from(graph.nodes).filter(node => graph.getNodeType(node) === NODE_TYPES.WAYPOINT);
        console.log(`   Total waypoints: ${waypoints.length}`);
        
        // Find waypoints with low connectivity
        const waypointConnectivity = waypoints.map(wp => {
            const neighbors = Array.from(graph.getNeighbors(wp));
            const waypointNeighbors = neighbors.filter(neighbor => graph.getNodeType(neighbor) === NODE_TYPES.WAYPOINT);
            return {
                waypoint: wp,
                totalNeighbors: neighbors.length,
                waypointNeighbors: waypointNeighbors.length,
                fixtureNeighbors: neighbors.length - waypointNeighbors.length
            };
        });
        
        // Sort by waypoint connectivity
        waypointConnectivity.sort((a, b) => a.waypointNeighbors - b.waypointNeighbors);
        
        console.log(`   Waypoints with lowest waypoint connectivity:`);
        waypointConnectivity.slice(0, 10).forEach(({ waypoint, waypointNeighbors, fixtureNeighbors }) => {
            console.log(`      ${waypoint}: ${waypointNeighbors} waypoint neighbors, ${fixtureNeighbors} fixture neighbors`);
        });
        
        console.log(`   Waypoints with highest waypoint connectivity:`);
        waypointConnectivity.slice(-10).forEach(({ waypoint, waypointNeighbors, fixtureNeighbors }) => {
            console.log(`      ${waypoint}: ${waypointNeighbors} waypoint neighbors, ${fixtureNeighbors} fixture neighbors`);
        });
        
        // Test pathfinding depth limits
        console.log(`\n🔍 Testing pathfinding depth limits:`);
        
        const testFrom = 'fossil_excavation_1';
        const testTo = 'di_05_01_top';
        
        if (graph.hasNode(testFrom) && graph.hasNode(testTo)) {
            const depthTests = [10, 20, 50, 100, 200, 500, 1000];
            
            for (const maxDepth of depthTests) {
                const path = pathfinder.findPath(testFrom, testTo, { maxDepth });
                console.log(`   Max depth ${maxDepth}: ${path ? `Found path (${path.length} nodes)` : 'No path'}`);
                
                if (path) {
                    console.log(`      Path: [${path.join(' → ')}]`);
                    break; // Found a path, no need to test higher depths
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ Error during pathfinding analysis:`, error);
        throw error;
    }
}

// Run the analysis
analyzePathfinding().catch(console.error);
