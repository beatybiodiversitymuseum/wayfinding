#!/usr/bin/env node

/**
 * Debug script to investigate pathfinding connectivity issues
 * 
 * This script will:
 * 1. Load the wayfinding graph
 * 2. Check specific fixture-to-waypoint connections
 * 3. Analyze the graph structure
 * 4. Test pathfinding between known connected nodes
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function debugConnectivity() {
    console.log(`🔍 Debugging pathfinding connectivity...`);
    
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
        
        console.log(`✅ Graph loaded successfully!`);
        console.log(`📊 Graph statistics:`, graph.getStatistics());
        
        // Check specific connections that should exist based on the wayfinding.geojson
        console.log(`\n🔍 Checking specific fixture-to-waypoint connections...`);
        
        const testConnections = [
            { fixture: 'fossil_excavation_8', waypoint: 'wp_126' },
            { fixture: 'fossil_excavation_9', waypoint: 'wp_120' },
            { fixture: 'di_27_18_top', waypoint: 'wp_064' },
            { fixture: 'di_31_20_top', waypoint: 'wp_076' }
        ];
        
        for (const { fixture, waypoint } of testConnections) {
            console.log(`\n📍 Testing: ${fixture} ↔ ${waypoint}`);
            
            // Check if nodes exist
            const fixtureExists = graph.hasNode(fixture);
            const waypointExists = graph.hasNode(waypoint);
            console.log(`   ${fixture} exists: ${fixtureExists}`);
            console.log(`   ${waypoint} exists: ${waypointExists}`);
            
            if (fixtureExists && waypointExists) {
                // Check direct connection
                const fixtureNeighbors = Array.from(graph.getNeighbors(fixture));
                const hasDirectConnection = fixtureNeighbors.includes(waypoint);
                console.log(`   Direct connection: ${hasDirectConnection}`);
                
                // Check neighbors
                const waypointNeighbors = Array.from(graph.getNeighbors(waypoint));
                console.log(`   ${fixture} neighbors: [${fixtureNeighbors.slice(0, 5).join(', ')}${fixtureNeighbors.length > 5 ? '...' : ''}] (${fixtureNeighbors.length} total)`);
                console.log(`   ${waypoint} neighbors: [${waypointNeighbors.slice(0, 5).join(', ')}${waypointNeighbors.length > 5 ? '...' : ''}] (${waypointNeighbors.length} total)`);
                
                // Test pathfinding
                const pathfinder = new Pathfinder(graph);
                const path = pathfinder.findPath(fixture, waypoint);
                console.log(`   Path exists: ${path ? 'YES' : 'NO'}`);
                if (path) {
                    console.log(`   Path: [${path.join(' → ')}]`);
                }
            }
        }
        
        // Analyze the overall graph structure
        console.log(`\n📊 Graph structure analysis:`);
        
        const allNodes = Array.from(graph.nodes);
        const waypoints = allNodes.filter(node => graph.getNodeType(node) === NODE_TYPES.WAYPOINT);
        const diBoxes = allNodes.filter(node => graph.getNodeType(node) === NODE_TYPES.DI_BOX);
        const fossils = allNodes.filter(node => graph.getNodeType(node) === NODE_TYPES.FOSSIL);
        
        console.log(`   Total nodes: ${allNodes.length}`);
        console.log(`   Waypoints: ${waypoints.length}`);
        console.log(`   DI boxes: ${diBoxes.length}`);
        console.log(`   Fossils: ${fossils.length}`);
        
        // Check average connectivity
        let totalConnections = 0;
        let connectedFixtures = 0;
        
        for (const fixture of [...diBoxes, ...fossils]) {
            const neighbors = Array.from(graph.getNeighbors(fixture));
            totalConnections += neighbors.length;
            if (neighbors.length > 0) {
                connectedFixtures++;
            }
        }
        
        console.log(`   Connected fixtures: ${connectedFixtures}/${diBoxes.length + fossils.length}`);
        console.log(`   Average connections per fixture: ${(totalConnections / (diBoxes.length + fossils.length)).toFixed(2)}`);
        
        // Check if fixtures are connected to waypoints specifically
        let fixturesConnectedToWaypoints = 0;
        for (const fixture of [...diBoxes, ...fossils]) {
            const neighbors = Array.from(graph.getNeighbors(fixture));
            const hasWaypointConnection = neighbors.some(neighbor => graph.getNodeType(neighbor) === NODE_TYPES.WAYPOINT);
            if (hasWaypointConnection) {
                fixturesConnectedToWaypoints++;
            }
        }
        
        console.log(`   Fixtures connected to waypoints: ${fixturesConnectedToWaypoints}/${diBoxes.length + fossils.length}`);
        
    } catch (error) {
        console.error(`❌ Error during connectivity debugging:`, error);
        throw error;
    }
}

// Run the debug
debugConnectivity().catch(console.error);
