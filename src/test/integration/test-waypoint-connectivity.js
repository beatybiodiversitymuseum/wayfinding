/**
 * Waypoint Network Connectivity Analysis
 * 
 * This script analyzes the connectivity of the waypoint network to determine
 * if all waypoints are reachable from each other, which is essential for
 * effective pathfinding between any two points in the system.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test waypoint network connectivity
 */
async function testWaypointConnectivity() {
    console.log(`🔍 Analyzing waypoint network connectivity...`);
    
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
        
        // Extract all waypoints
        const waypoints = Array.from(graph.nodes).filter(nodeId => 
            graph.getNodeType(nodeId) === NODE_TYPES.WAYPOINT
        );
        
        console.log(`\n🎯 WAYPOINT ANALYSIS:`);
        console.log(`📊 Total waypoints: ${waypoints.length}`);
        
        if (waypoints.length === 0) {
            console.log(`❌ No waypoints found in the graph!`);
            return;
        }
        
        // Create pathfinder
        const pathfinder = new Pathfinder(graph);
        
        // Test connectivity between all waypoint pairs
        console.log(`\n🔍 Testing waypoint connectivity...`);
        
        const results = {
            totalTests: 0,
            successfulPaths: 0,
            failedPaths: 0,
            connectedComponents: [],
            isolatedWaypoints: [],
            connectivityMatrix: new Map()
        };
        
        // Use Union-Find to find connected components
        const parent = new Map();
        const rank = new Map();
        
        // Initialize Union-Find
        for (const waypoint of waypoints) {
            parent.set(waypoint, waypoint);
            rank.set(waypoint, 0);
        }
        
        function find(x) {
            if (parent.get(x) !== x) {
                parent.set(x, find(parent.get(x)));
            }
            return parent.get(x);
        }
        
        function union(x, y) {
            const rootX = find(x);
            const rootY = find(y);
            
            if (rootX !== rootY) {
                if (rank.get(rootX) < rank.get(rootY)) {
                    parent.set(rootX, rootY);
                } else if (rank.get(rootX) > rank.get(rootY)) {
                    parent.set(rootY, rootX);
                } else {
                    parent.set(rootY, rootX);
                    rank.set(rootX, rank.get(rootX) + 1);
                }
            }
        }
        
        // Test connectivity between waypoints
        let progressCount = 0;
        const totalPairs = (waypoints.length * (waypoints.length - 1)) / 2;
        
        for (let i = 0; i < waypoints.length; i++) {
            for (let j = i + 1; j < waypoints.length; j++) {
                const source = waypoints[i];
                const target = waypoints[j];
                
                results.totalTests++;
                progressCount++;
                
                if (progressCount % 100 === 0) {
                    const progress = (progressCount / totalPairs * 100).toFixed(1);
                    console.log(`📈 Progress: ${progressCount}/${totalPairs} (${progress}%)`);
                }
                
                try {
                    const path = pathfinder.findPath(source, target);
                    
                    if (path) {
                        results.successfulPaths++;
                        // Mark as connected in Union-Find
                        union(source, target);
                        
                        // Store connectivity info
                        const key = `${source}-${target}`;
                        results.connectivityMatrix.set(key, {
                            source,
                            target,
                            pathLength: path.length,
                            path: path
                        });
                    } else {
                        results.failedPaths++;
                    }
                } catch (error) {
                    results.failedPaths++;
                    console.warn(`Error testing ${source} → ${target}:`, error.message);
                }
            }
        }
        
        // Analyze connected components
        const componentGroups = new Map();
        for (const waypoint of waypoints) {
            const root = find(waypoint);
            if (!componentGroups.has(root)) {
                componentGroups.set(root, []);
            }
            componentGroups.get(root).push(waypoint);
        }
        
        results.connectedComponents = Array.from(componentGroups.values());
        
        // Find isolated waypoints (components with only 1 waypoint)
        results.isolatedWaypoints = results.connectedComponents
            .filter(component => component.length === 1)
            .flat();
        
        // Print results
        console.log(`\n🎯 WAYPOINT CONNECTIVITY RESULTS:`);
        console.log(`📊 Total Tests: ${results.totalTests}`);
        console.log(`✅ Successful Paths: ${results.successfulPaths}`);
        console.log(`❌ Failed Paths: ${results.failedPaths}`);
        console.log(`📈 Success Rate: ${((results.successfulPaths / results.totalTests) * 100).toFixed(2)}%`);
        
        console.log(`\n🔗 CONNECTED COMPONENTS ANALYSIS:`);
        console.log(`📊 Number of connected components: ${results.connectedComponents.length}`);
        console.log(`📊 Largest component size: ${Math.max(...results.connectedComponents.map(c => c.length))}`);
        console.log(`📊 Isolated waypoints: ${results.isolatedWaypoints.length}`);
        
        // Show component details
        results.connectedComponents.forEach((component, index) => {
            if (component.length > 1) {
                console.log(`\n🔗 Component ${index + 1}: ${component.length} waypoints`);
                console.log(`   Waypoints: ${component.slice(0, 5).join(', ')}${component.length > 5 ? '...' : ''}`);
            } else {
                console.log(`\n🔗 Isolated waypoint: ${component[0]}`);
            }
        });
        
        // Check if the network is fully connected
        const isFullyConnected = results.connectedComponents.length === 1 && results.isolatedWaypoints.length === 0;
        
        console.log(`\n🎯 NETWORK CONNECTIVITY STATUS:`);
        if (isFullyConnected) {
            console.log(`✅ FULLY CONNECTED: All waypoints are reachable from each other!`);
        } else {
            console.log(`❌ PARTIALLY CONNECTED: Network has ${results.connectedComponents.length} disconnected components`);
            if (results.isolatedWaypoints.length > 0) {
                console.log(`⚠️  ${results.isolatedWaypoints.length} isolated waypoints found`);
            }
        }
        
        // Sample some successful paths
        if (results.successfulPaths > 0) {
            console.log(`\n📋 SAMPLE SUCCESSFUL PATHS:`);
            const samplePaths = Array.from(results.connectivityMatrix.values()).slice(0, 3);
            samplePaths.forEach((pathInfo, index) => {
                console.log(`${index + 1}. ${pathInfo.source} → ${pathInfo.target}: ${pathInfo.pathLength} nodes`);
                console.log(`   Path: ${pathInfo.path.join(' → ')}`);
            });
        }
        
        // Save detailed results
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalWaypoints: waypoints.length,
                totalTests: results.totalTests,
                successfulPaths: results.successfulPaths,
                failedPaths: results.failedPaths,
                successRate: (results.successfulPaths / results.totalTests) * 100,
                connectedComponents: results.connectedComponents.length,
                isolatedWaypoints: results.isolatedWaypoints.length,
                isFullyConnected: isFullyConnected
            },
            waypoints: waypoints,
            connectedComponents: results.connectedComponents,
            isolatedWaypoints: results.isolatedWaypoints,
            samplePaths: Array.from(results.connectivityMatrix.values()).slice(0, 10)
        };
        
        const reportPath = './waypoint-connectivity-results.json';
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n💾 Detailed results saved to: ${reportPath}`);
        
        return {
            isFullyConnected,
            totalWaypoints: waypoints.length,
            successRate: (results.successfulPaths / results.totalTests) * 100,
            connectedComponents: results.connectedComponents.length,
            isolatedWaypoints: results.isolatedWaypoints.length
        };
        
    } catch (error) {
        console.error(`💥 Error analyzing waypoint connectivity:`, error);
        throw error;
    }
}

// Run the analysis if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testWaypointConnectivity()
        .then(results => {
            console.log(`\n🎉 Waypoint connectivity analysis completed!`);
            if (results.isFullyConnected) {
                console.log(`✅ The waypoint network is fully connected!`);
            } else {
                console.log(`⚠️  The waypoint network has connectivity issues.`);
            }
            process.exit(0);
        })
        .catch(error => {
            console.error(`💥 Analysis failed:`, error);
            process.exit(1);
        });
}

export { testWaypointConnectivity };
