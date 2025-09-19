#!/usr/bin/env node

/**
 * Pathfinding Bug Investigation
 * 
 * This script investigates the contradiction: waypoint network is connected,
 * but pathfinding fails between fixtures that should be reachable.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function investigatePathfindingBug() {
    console.log(`🔍 Investigating pathfinding bug...`);
    
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
        
        // Test the specific failing case: fossil_excavation_5 → di_05_01_top
        console.log(`\n🧪 Testing specific failing case:`);
        
        const from = 'fossil_excavation_5';
        const to = 'di_05_01_top';
        
        console.log(`   Testing: ${from} → ${to}`);
        
        // Check if nodes exist
        console.log(`   ${from} exists: ${graph.hasNode(from)}`);
        console.log(`   ${to} exists: ${graph.hasNode(to)}`);
        
        if (!graph.hasNode(from) || !graph.hasNode(to)) {
            console.log(`   ❌ Missing nodes - cannot test`);
            return;
        }
        
        // Check waypoint connectivity
        const fromNeighbors = Array.from(graph.getNeighbors(from));
        const toNeighbors = Array.from(graph.getNeighbors(to));
        
        const fromWaypoints = fromNeighbors.filter(n => graph.getNodeType(n) === NODE_TYPES.WAYPOINT);
        const toWaypoints = toNeighbors.filter(n => graph.getNodeType(n) === NODE_TYPES.WAYPOINT);
        
        console.log(`   ${from} waypoint neighbors: [${fromWaypoints.join(', ')}]`);
        console.log(`   ${to} waypoint neighbors: [${toWaypoints.join(', ')}]`);
        
        // Test waypoint-to-waypoint connectivity
        console.log(`\n🔗 Testing waypoint connectivity:`);
        
        for (const fromWp of fromWaypoints) {
            for (const toWp of toWaypoints) {
                const wpPath = pathfinder.findPath(fromWp, toWp);
                console.log(`   ${fromWp} → ${toWp}: ${wpPath ? `Found (${wpPath.length} nodes)` : 'Not found'}`);
                
                if (wpPath) {
                    console.log(`      Path: [${wpPath.join(' → ')}]`);
                }
            }
        }
        
        // Test the full path
        console.log(`\n🛤️  Testing full path:`);
        const fullPath = pathfinder.findPath(from, to);
        console.log(`   Full path result: ${fullPath ? `Found (${fullPath.length} nodes)` : 'Not found'}`);
        
        if (fullPath) {
            console.log(`   Path: [${fullPath.join(' → ')}]`);
        }
        
        // Manual step-by-step path construction
        console.log(`\n🔧 Manual path construction test:`);
        
        if (fromWaypoints.length > 0 && toWaypoints.length > 0) {
            // Try to construct a path manually
            const fromWp = fromWaypoints[0];
            const toWp = toWaypoints[0];
            
            const wpPath = pathfinder.findPath(fromWp, toWp);
            if (wpPath) {
                console.log(`   Waypoint path: [${wpPath.join(' → ')}]`);
                
                // Construct full path: from → fromWp → ... → toWp → to
                const manualPath = [from, ...wpPath, to];
                console.log(`   Manual full path: [${manualPath.join(' → ')}]`);
                
                // Verify each step of the manual path
                console.log(`   Verifying manual path steps:`);
                let isValid = true;
                for (let i = 0; i < manualPath.length - 1; i++) {
                    const current = manualPath[i];
                    const next = manualPath[i + 1];
                    const currentType = graph.getNodeType(current);
                    const nextType = graph.getNodeType(next);
                    
                    const canVisit = pathfinder._canVisitNeighbor(currentType, nextType, false);
                    console.log(`      ${current} (${currentType}) → ${next} (${nextType}): ${canVisit ? 'ALLOWED' : 'BLOCKED'}`);
                    
                    if (!canVisit) {
                        console.log(`      ❌ Manual path has invalid step!`);
                        isValid = false;
                        break;
                    }
                }
                
                if (isValid) {
                    console.log(`   ✅ Manual path is valid - pathfinding algorithm should find this path`);
                }
            }
        }
        
        // Test with different pathfinding options
        console.log(`\n⚙️  Testing with different options:`);
        
        const options = [
            { maxDepth: 10 },
            { maxDepth: 50 },
            { maxDepth: 100 },
            { maxDepth: 1000 },
            { allowDirectFixtureConnections: true },
            { maxDepth: 1000, allowDirectFixtureConnections: true }
        ];
        
        for (const option of options) {
            const path = pathfinder.findPath(from, to, option);
            const optionStr = Object.entries(option).map(([k, v]) => `${k}: ${v}`).join(', ');
            console.log(`   ${optionStr}: ${path ? `Found (${path.length} nodes)` : 'Not found'}`);
        }
        
        // Check if there's an issue with the BFS implementation
        console.log(`\n🔍 BFS implementation check:`);
        
        // Test a simple case that should work
        const simpleFrom = fromWaypoints[0];
        const simpleTo = toWaypoints[0];
        
        if (simpleFrom && simpleTo) {
            console.log(`   Testing simple waypoint path: ${simpleFrom} → ${simpleTo}`);
            
            const simplePath = pathfinder.findPath(simpleFrom, simpleTo);
            console.log(`   Simple path result: ${simplePath ? `Found (${simplePath.length} nodes)` : 'Not found'}`);
            
            if (simplePath) {
                console.log(`   Simple path: [${simplePath.join(' → ')}]`);
                
                // Now test if we can extend this path
                console.log(`   Testing extended path: ${from} → ${simpleFrom} → ... → ${simpleTo} → ${to}`);
                
                const extendedPath = pathfinder.findPath(from, to);
                console.log(`   Extended path result: ${extendedPath ? `Found (${extendedPath.length} nodes)` : 'Not found'}`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error during pathfinding bug investigation:`, error);
        throw error;
    }
}

// Run the investigation
investigatePathfindingBug().catch(console.error);
