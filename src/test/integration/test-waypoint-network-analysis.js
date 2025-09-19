#!/usr/bin/env node

/**
 * Waypoint Network Analysis Script
 * 
 * This script analyzes the waypoint network structure to understand
 * why pathfinding requires such long paths through many waypoints.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function analyzeWaypointNetwork() {
    console.log(`🔍 Analyzing waypoint network structure...`);
    
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
        
        // Analyze waypoint network
        const waypoints = Array.from(graph.nodes).filter(node => graph.getNodeType(node) === NODE_TYPES.WAYPOINT);
        console.log(`📊 Total waypoints: ${waypoints.length}`);
        
        // Calculate waypoint-to-waypoint connectivity
        const waypointConnectivity = waypoints.map(wp => {
            const neighbors = Array.from(graph.getNeighbors(wp));
            const waypointNeighbors = neighbors.filter(neighbor => graph.getNodeType(neighbor) === NODE_TYPES.WAYPOINT);
            const fixtureNeighbors = neighbors.filter(neighbor => {
                const type = graph.getNodeType(neighbor);
                return type === NODE_TYPES.DI_BOX || type === NODE_TYPES.FOSSIL || type === NODE_TYPES.CABINET;
            });
            
            return {
                waypoint: wp,
                totalNeighbors: neighbors.length,
                waypointNeighbors: waypointNeighbors.length,
                fixtureNeighbors: fixtureNeighbors.length,
                waypointNeighborList: waypointNeighbors
            };
        });
        
        // Sort by waypoint connectivity
        waypointConnectivity.sort((a, b) => a.waypointNeighbors - b.waypointNeighbors);
        
        console.log(`\n📈 Waypoint connectivity distribution:`);
        const connectivityStats = {};
        waypointConnectivity.forEach(({ waypointNeighbors }) => {
            connectivityStats[waypointNeighbors] = (connectivityStats[waypointNeighbors] || 0) + 1;
        });
        
        Object.entries(connectivityStats).forEach(([connections, count]) => {
            console.log(`   ${connections} waypoint connections: ${count} waypoints`);
        });
        
        console.log(`\n🔗 Waypoint network analysis:`);
        const totalWaypointConnections = waypointConnectivity.reduce((sum, wp) => sum + wp.waypointNeighbors, 0);
        const avgWaypointConnections = totalWaypointConnections / waypoints.length;
        console.log(`   Average waypoint-to-waypoint connections: ${avgWaypointConnections.toFixed(2)}`);
        
        // Find isolated or poorly connected waypoints
        const isolatedWaypoints = waypointConnectivity.filter(wp => wp.waypointNeighbors <= 2);
        console.log(`   Poorly connected waypoints (≤2 connections): ${isolatedWaypoints.length}`);
        
        if (isolatedWaypoints.length > 0) {
            console.log(`   Examples of poorly connected waypoints:`);
            isolatedWaypoints.slice(0, 10).forEach(({ waypoint, waypointNeighbors, waypointNeighborList }) => {
                console.log(`      ${waypoint}: ${waypointNeighbors} connections [${waypointNeighborList.join(', ')}]`);
            });
        }
        
        // Analyze path lengths between waypoints
        console.log(`\n📏 Path length analysis between waypoints:`);
        
        // Test a sample of waypoint pairs
        const sampleSize = Math.min(20, waypoints.length);
        const sampleWaypoints = waypoints.slice(0, sampleSize);
        
        const pathLengths = [];
        let totalTests = 0;
        
        for (let i = 0; i < sampleWaypoints.length; i++) {
            for (let j = i + 1; j < sampleWaypoints.length; j++) {
                const from = sampleWaypoints[i];
                const to = sampleWaypoints[j];
                totalTests++;
                
                const path = pathfinder.findPath(from, to);
                if (path) {
                    pathLengths.push(path.length);
                }
            }
        }
        
        if (pathLengths.length > 0) {
            const avgPathLength = pathLengths.reduce((sum, len) => sum + len, 0) / pathLengths.length;
            const maxPathLength = Math.max(...pathLengths);
            const minPathLength = Math.min(...pathLengths);
            
            console.log(`   Tested ${totalTests} waypoint pairs`);
            console.log(`   Average path length: ${avgPathLength.toFixed(2)} nodes`);
            console.log(`   Min path length: ${minPathLength} nodes`);
            console.log(`   Max path length: ${maxPathLength} nodes`);
            
            // Analyze path length distribution
            const lengthDistribution = {};
            pathLengths.forEach(len => {
                lengthDistribution[len] = (lengthDistribution[len] || 0) + 1;
            });
            
            console.log(`   Path length distribution:`);
            Object.entries(lengthDistribution).forEach(([length, count]) => {
                const percentage = (count / pathLengths.length * 100).toFixed(1);
                console.log(`      ${length} nodes: ${count} paths (${percentage}%)`);
            });
        }
        
        // Check for potential missing connections
        console.log(`\n🔍 Potential network improvements:`);
        
        // Find waypoints that are close in the network but not directly connected
        const potentialShortcuts = [];
        
        for (let i = 0; i < Math.min(10, waypoints.length); i++) {
            const wp1 = waypoints[i];
            const path1 = pathfinder.findPath(wp1, waypoints[(i + 1) % waypoints.length]);
            
            if (path1 && path1.length > 3) {
                // These waypoints are connected but through a long path
                potentialShortcuts.push({
                    from: wp1,
                    to: waypoints[(i + 1) % waypoints.length],
                    currentPathLength: path1.length,
                    path: path1
                });
            }
        }
        
        if (potentialShortcuts.length > 0) {
            console.log(`   Found ${potentialShortcuts.length} potential shortcuts:`);
            potentialShortcuts.slice(0, 5).forEach(({ from, to, currentPathLength, path }) => {
                console.log(`      ${from} → ${to}: currently ${currentPathLength} nodes`);
                console.log(`         Path: [${path.join(' → ')}]`);
            });
        }
        
        // Summary recommendations
        console.log(`\n💡 Network optimization recommendations:`);
        
        if (avgWaypointConnections < 3) {
            console.log(`   ⚠️  Low average waypoint connectivity (${avgWaypointConnections.toFixed(2)})`);
            console.log(`   💡 Consider adding more waypoint-to-waypoint connections`);
        }
        
        if (pathLengths.length > 0) {
            const avgPathLength = pathLengths.reduce((sum, len) => sum + len, 0) / pathLengths.length;
            if (avgPathLength > 5) {
                console.log(`   ⚠️  Long average path lengths (${avgPathLength.toFixed(2)} nodes)`);
                console.log(`   💡 Consider adding strategic shortcuts between distant waypoints`);
            }
        }
        
        if (isolatedWaypoints.length > waypoints.length * 0.2) {
            console.log(`   ⚠️  High number of poorly connected waypoints (${isolatedWaypoints.length}/${waypoints.length})`);
            console.log(`   💡 Review waypoint placement and connections`);
        }
        
    } catch (error) {
        console.error(`❌ Error during waypoint network analysis:`, error);
        throw error;
    }
}

// Run the analysis
analyzeWaypointNetwork().catch(console.error);
