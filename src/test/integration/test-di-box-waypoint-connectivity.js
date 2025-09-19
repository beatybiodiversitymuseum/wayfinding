/**
 * DI Box to Waypoint Connectivity Analysis
 * 
 * This script analyzes the connectivity between DI boxes and waypoints to determine
 * if all DI boxes are properly connected to at least one waypoint, which is essential
 * for pathfinding to work effectively.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test DI box to waypoint connectivity
 */
async function testDiBoxWaypointConnectivity() {
    console.log(`🔍 Analyzing DI box to waypoint connectivity...`);
    
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
        
        // Extract all DI boxes and waypoints
        const diBoxes = Array.from(graph.nodes).filter(nodeId => 
            graph.getNodeType(nodeId) === NODE_TYPES.DI_BOX
        );
        
        const waypoints = Array.from(graph.nodes).filter(nodeId => 
            graph.getNodeType(nodeId) === NODE_TYPES.WAYPOINT
        );
        
        console.log(`\n🎯 DI BOX TO WAYPOINT ANALYSIS:`);
        console.log(`📊 Total DI boxes: ${diBoxes.length}`);
        console.log(`📊 Total waypoints: ${waypoints.length}`);
        
        if (diBoxes.length === 0) {
            console.log(`❌ No DI boxes found in the graph!`);
            return;
        }
        
        if (waypoints.length === 0) {
            console.log(`❌ No waypoints found in the graph!`);
            return;
        }
        
        // Create pathfinder
        const pathfinder = new Pathfinder(graph);
        
        // Test connectivity from each DI box to waypoints
        console.log(`\n🔍 Testing DI box to waypoint connectivity...`);
        
        const results = {
            totalDiBoxes: diBoxes.length,
            connectedDiBoxes: 0,
            disconnectedDiBoxes: 0,
            diBoxConnectivity: new Map(),
            disconnectedDiBoxList: [],
            connectedDiBoxList: [],
            connectivityStats: {
                totalTests: 0,
                successfulPaths: 0,
                failedPaths: 0,
                minConnections: Infinity,
                maxConnections: 0,
                avgConnections: 0
            }
        };
        
        let progressCount = 0;
        
        for (const diBox of diBoxes) {
            progressCount++;
            
            if (progressCount % 50 === 0) {
                const progress = (progressCount / diBoxes.length * 100).toFixed(1);
                console.log(`📈 Progress: ${progressCount}/${diBoxes.length} (${progress}%)`);
            }
            
            const diBoxResults = {
                diBox: diBox,
                connectedWaypoints: [],
                disconnectedWaypoints: [],
                totalConnections: 0,
                isConnected: false
            };
            
            // Test connection to each waypoint
            for (const waypoint of waypoints) {
                results.connectivityStats.totalTests++;
                
                try {
                    const path = pathfinder.findPath(diBox, waypoint);
                    
                    if (path) {
                        results.connectivityStats.successfulPaths++;
                        diBoxResults.connectedWaypoints.push({
                            waypoint: waypoint,
                            pathLength: path.length,
                            path: path
                        });
                        diBoxResults.totalConnections++;
                    } else {
                        results.connectivityStats.failedPaths++;
                        diBoxResults.disconnectedWaypoints.push(waypoint);
                    }
                } catch (error) {
                    results.connectivityStats.failedPaths++;
                    diBoxResults.disconnectedWaypoints.push(waypoint);
                    console.warn(`Error testing ${diBox} → ${waypoint}:`, error.message);
                }
            }
            
            // Determine if DI box is connected to at least one waypoint
            diBoxResults.isConnected = diBoxResults.totalConnections > 0;
            
            if (diBoxResults.isConnected) {
                results.connectedDiBoxes++;
                results.connectedDiBoxList.push(diBox);
                
                // Update connection statistics
                results.connectivityStats.minConnections = Math.min(results.connectivityStats.minConnections, diBoxResults.totalConnections);
                results.connectivityStats.maxConnections = Math.max(results.connectivityStats.maxConnections, diBoxResults.totalConnections);
            } else {
                results.disconnectedDiBoxes++;
                results.disconnectedDiBoxList.push(diBox);
            }
            
            results.diBoxConnectivity.set(diBox, diBoxResults);
        }
        
        // Calculate average connections
        if (results.connectedDiBoxes > 0) {
            const totalConnections = Array.from(results.diBoxConnectivity.values())
                .filter(diBoxResult => diBoxResult.isConnected)
                .reduce((sum, diBoxResult) => sum + diBoxResult.totalConnections, 0);
            results.connectivityStats.avgConnections = totalConnections / results.connectedDiBoxes;
        }
        
        // Print results
        console.log(`\n🎯 DI BOX TO WAYPOINT CONNECTIVITY RESULTS:`);
        console.log(`📊 Total DI Boxes: ${results.totalDiBoxes}`);
        console.log(`✅ Connected DI Boxes: ${results.connectedDiBoxes}`);
        console.log(`❌ Disconnected DI Boxes: ${results.disconnectedDiBoxes}`);
        console.log(`📈 Connection Rate: ${((results.connectedDiBoxes / results.totalDiBoxes) * 100).toFixed(2)}%`);
        
        console.log(`\n📊 CONNECTIVITY STATISTICS:`);
        console.log(`📊 Total Tests: ${results.connectivityStats.totalTests}`);
        console.log(`✅ Successful Paths: ${results.connectivityStats.successfulPaths}`);
        console.log(`❌ Failed Paths: ${results.connectivityStats.failedPaths}`);
        console.log(`📈 Overall Success Rate: ${((results.connectivityStats.successfulPaths / results.connectivityStats.totalTests) * 100).toFixed(2)}%`);
        
        if (results.connectedDiBoxes > 0) {
            console.log(`\n🔗 CONNECTION STATISTICS (for connected DI boxes):`);
            console.log(`📊 Min connections per DI box: ${results.connectivityStats.minConnections}`);
            console.log(`📊 Max connections per DI box: ${results.connectivityStats.maxConnections}`);
            console.log(`📊 Average connections per DI box: ${results.connectivityStats.avgConnections.toFixed(2)}`);
        }
        
        // Show disconnected DI boxes
        if (results.disconnectedDiBoxes > 0) {
            console.log(`\n❌ DISCONNECTED DI BOXES (${results.disconnectedDiBoxes}):`);
            const displayCount = Math.min(20, results.disconnectedDiBoxes);
            results.disconnectedDiBoxList.slice(0, displayCount).forEach((diBox, index) => {
                console.log(`${index + 1}. ${diBox}`);
            });
            if (results.disconnectedDiBoxes > 20) {
                console.log(`... and ${results.disconnectedDiBoxes - 20} more`);
            }
        }
        
        // Show sample connected DI boxes with their connections
        if (results.connectedDiBoxes > 0) {
            console.log(`\n✅ SAMPLE CONNECTED DI BOXES:`);
            const sampleDiBoxes = results.connectedDiBoxList.slice(0, 3);
            sampleDiBoxes.forEach((diBox, index) => {
                const diBoxResult = results.diBoxConnectivity.get(diBox);
                console.log(`${index + 1}. ${diBox}: Connected to ${diBoxResult.totalConnections}/${waypoints.length} waypoints`);
                
                // Show shortest path example
                const shortestPath = diBoxResult.connectedWaypoints.reduce((shortest, current) => 
                    current.pathLength < shortest.pathLength ? current : shortest
                );
                console.log(`   Shortest path: ${shortestPath.pathLength} nodes to ${shortestPath.waypoint}`);
                console.log(`   Path: ${shortestPath.path.join(' → ')}`);
            });
        }
        
        // Overall assessment
        const isAllConnected = results.disconnectedDiBoxes === 0;
        
        console.log(`\n🎯 DI BOX CONNECTIVITY STATUS:`);
        if (isAllConnected) {
            console.log(`✅ ALL DI BOXES CONNECTED: Every DI box is reachable from at least one waypoint!`);
        } else {
            console.log(`❌ PARTIALLY CONNECTED: ${results.disconnectedDiBoxes} DI boxes are not connected to any waypoint`);
            console.log(`⚠️  This explains why some fossil-to-DI box paths fail in pathfinding`);
        }
        
        // Save detailed results
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalDiBoxes: results.totalDiBoxes,
                connectedDiBoxes: results.connectedDiBoxes,
                disconnectedDiBoxes: results.disconnectedDiBoxes,
                connectionRate: (results.connectedDiBoxes / results.totalDiBoxes) * 100,
                isAllConnected: isAllConnected,
                totalTests: results.connectivityStats.totalTests,
                successfulPaths: results.connectivityStats.successfulPaths,
                failedPaths: results.connectivityStats.failedPaths,
                overallSuccessRate: (results.connectivityStats.successfulPaths / results.connectivityStats.totalTests) * 100
            },
            connectivityStats: results.connectivityStats,
            connectedDiBoxes: results.connectedDiBoxList,
            disconnectedDiBoxes: results.disconnectedDiBoxList,
            sampleConnections: Array.from(results.diBoxConnectivity.entries())
                .filter(([_, result]) => result.isConnected)
                .slice(0, 5)
                .map(([diBox, result]) => ({
                    diBox: diBox,
                    totalConnections: result.totalConnections,
                    samplePaths: result.connectedWaypoints.slice(0, 2).map(conn => ({
                        waypoint: conn.waypoint,
                        pathLength: conn.pathLength
                    }))
                }))
        };
        
        const reportPath = './di-box-waypoint-connectivity-results.json';
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n💾 Detailed results saved to: ${reportPath}`);
        
        return {
            isAllConnected,
            connectionRate: (results.connectedDiBoxes / results.totalDiBoxes) * 100,
            disconnectedCount: results.disconnectedDiBoxes,
            totalDiBoxes: results.totalDiBoxes
        };
        
    } catch (error) {
        console.error(`💥 Error analyzing DI box to waypoint connectivity:`, error);
        throw error;
    }
}

// Run the analysis if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testDiBoxWaypointConnectivity()
        .then(results => {
            console.log(`\n🎉 DI box to waypoint connectivity analysis completed!`);
            if (results.isAllConnected) {
                console.log(`✅ All DI boxes are connected to waypoints!`);
            } else {
                console.log(`⚠️  ${results.disconnectedCount} DI boxes are not connected to waypoints.`);
            }
            process.exit(0);
        })
        .catch(error => {
            console.error(`💥 Analysis failed:`, error);
            process.exit(1);
        });
}

export { testDiBoxWaypointConnectivity };
