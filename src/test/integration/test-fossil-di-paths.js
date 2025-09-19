/**
 * Comprehensive Fossil-to-DI Box Path Testing
 * 
 * This script tests paths between ALL fossil excavation fixtures and ALL DI box fixtures
 * in the wayfinding system. No exceptions - every combination is tested.
 * 
 * RESULTS:
 * - 9 fossil excavation fixtures
 * - 248 DI box fixtures  
 * - 2,232 total path combinations to test
 */

import { WayfindingDataManager } from '../../data/loader.js';
import { Pathfinder, NODE_TYPES } from '../../core/pathfinding.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// All fossil excavation fixtures
const FOSSIL_FIXTURES = [
    'fossil_excavation_1',
    'fossil_excavation_2', 
    'fossil_excavation_3',
    'fossil_excavation_4',
    'fossil_excavation_5',
    'fossil_excavation_6',
    'fossil_excavation_7',
    'fossil_excavation_8',
    'fossil_excavation_9'
];

// All DI box fixtures (extracted from the actual GeoJSON data)
const DI_BOX_FIXTURES = [
    'di_05_01_L1', 'di_05_01_L2', 'di_05_01_L3', 'di_05_01_top',
    'di_05_02_L1', 'di_05_02_L2', 'di_05_02_L3', 'di_05_02_top',
    'di_05_03_L1', 'di_05_03_L2', 'di_05_03_L3', 'di_05_03_top',
    'di_06_01_L1', 'di_06_01_L2', 'di_06_01_L3', 'di_06_01_top',
    'di_06_02_L1', 'di_06_02_L2', 'di_06_02_L3', 'di_06_02_top',
    'di_06_03_L1', 'di_06_03_L2', 'di_06_03_L3', 'di_06_03_top',
    'di_11_04_L1', 'di_11_04_L2', 'di_11_04_L3', 'di_11_04_top',
    'di_11_05_L1', 'di_11_05_L2', 'di_11_05_L3', 'di_11_05_top',
    'di_12_04_L1', 'di_12_04_L2', 'di_12_04_L3', 'di_12_04_top',
    'di_12_05_L1', 'di_12_05_L2', 'di_12_05_L3', 'di_12_05_top',
    'di_15_06_L1', 'di_15_06_L2', 'di_15_06_L3', 'di_15_06_top',
    'di_15_07_L1', 'di_15_07_L2', 'di_15_07_L3', 'di_15_07_top',
    'di_16_06_L1', 'di_16_06_L2', 'di_16_06_L3', 'di_16_06_top',
    'di_16_07_L1', 'di_16_07_L2', 'di_16_07_L3', 'di_16_07_top',
    'di_17_08_L1', 'di_17_08_L2', 'di_17_08_L3', 'di_17_08_top',
    'di_17_09_L1', 'di_17_09_L2', 'di_17_09_L3', 'di_17_09_top',
    'di_17_10_L1', 'di_17_10_L2', 'di_17_10_L3', 'di_17_10_top',
    'di_17_11_L1', 'di_17_11_L2', 'di_17_11_L3', 'di_17_11_top',
    'di_17_12_L1', 'di_17_12_L2', 'di_17_12_L3', 'di_17_12_top',
    'di_17_13_L1', 'di_17_13_L2', 'di_17_13_L3', 'di_17_13_top',
    'di_18_08_L1', 'di_18_08_L2', 'di_18_08_L3', 'di_18_08_top',
    'di_18_09_L1', 'di_18_09_L2', 'di_18_09_L3', 'di_18_09_top',
    'di_18_10_L1', 'di_18_10_L2', 'di_18_10_L3', 'di_18_10_top',
    'di_18_11_L1', 'di_18_11_L2', 'di_18_11_L3', 'di_18_11_top',
    'di_18_12_L1', 'di_18_12_L2', 'di_18_12_L3', 'di_18_12_top',
    'di_18_13_L1', 'di_18_13_L2', 'di_18_13_L3', 'di_18_13_top',
    'di_19_14_L1', 'di_19_14_L2', 'di_19_14_L3', 'di_19_14_top',
    'di_19_15_L1', 'di_19_15_L2', 'di_19_15_L3', 'di_19_15_top',
    'di_20_14_L1', 'di_20_14_L2', 'di_20_14_L3', 'di_20_14_top',
    'di_20_15_L1', 'di_20_15_L2', 'di_20_15_L3', 'di_20_15_top',
    'di_23_16_L1', 'di_23_16_L2', 'di_23_16_L3', 'di_23_16_top',
    'di_23_17_L1', 'di_23_17_L2', 'di_23_17_L3', 'di_23_17_top',
    'di_24_16_L1', 'di_24_16_L2', 'di_24_16_L3', 'di_24_16_top',
    'di_24_17_L1', 'di_24_17_L2', 'di_24_17_L3', 'di_24_17_top',
    'di_27_18_L1', 'di_27_18_L2', 'di_27_18_L3', 'di_27_18_top',
    'di_27_19_L1', 'di_27_19_L2', 'di_27_19_L3', 'di_27_19_top',
    'di_28_18_L1', 'di_28_18_L2', 'di_28_18_L3', 'di_28_18_top',
    'di_28_19_L1', 'di_28_19_L2', 'di_28_19_L3', 'di_28_19_top',
    'di_31_20_L1', 'di_31_20_L2', 'di_31_20_L3', 'di_31_20_top',
    'di_31_21_L1', 'di_31_21_L2', 'di_31_21_L3', 'di_31_21_top',
    'di_32_20_L1', 'di_32_20_L2', 'di_32_20_L3', 'di_32_20_top',
    'di_32_21_L1', 'di_32_21_L2', 'di_32_21_L3', 'di_32_21_top',
    'di_35_22_L1', 'di_35_22_L2', 'di_35_22_L3', 'di_35_22_top',
    'di_35_23_L1', 'di_35_23_L2', 'di_35_23_L3', 'di_35_23_top',
    'di_35_24_L1', 'di_35_24_L2', 'di_35_24_L3', 'di_35_24_top',
    'di_35_25_L1', 'di_35_25_L2', 'di_35_25_L3', 'di_35_25_top',
    'di_35_26_L1', 'di_35_26_L2', 'di_35_26_L3', 'di_35_26_top',
    'di_35_27_L1', 'di_35_27_L2', 'di_35_27_L3', 'di_35_27_top',
    'di_36_22_L1', 'di_36_22_L2', 'di_36_22_L3', 'di_36_22_top',
    'di_36_23_L1', 'di_36_23_L2', 'di_36_23_L3', 'di_36_23_top',
    'di_36_24_L1', 'di_36_24_L2', 'di_36_24_L3', 'di_36_24_top',
    'di_36_25_L1', 'di_36_25_L2', 'di_36_25_L3', 'di_36_25_top',
    'di_36_26_L1', 'di_36_26_L2', 'di_36_26_L3', 'di_36_26_top',
    'di_36_27_L1', 'di_36_27_L2', 'di_36_27_L3', 'di_36_27_top',
    'di_37_28_L1', 'di_37_28_L2', 'di_37_28_L3', 'di_37_28_top',
    'di_37_29_L1', 'di_37_29_L2', 'di_37_29_L3', 'di_37_29_top',
    'di_38_28_L1', 'di_38_28_L2', 'di_38_28_L3', 'di_38_28_top',
    'di_38_29_L1', 'di_38_29_L2', 'di_38_29_L3', 'di_38_29_top',
    'di_51_30_L1', 'di_51_30_L2', 'di_51_30_L3', 'di_51_30_top',
    'di_51_31_L1', 'di_51_31_L2', 'di_51_31_L3', 'di_51_31_top',
    'di_52_30_L1', 'di_52_30_L2', 'di_52_30_L3', 'di_52_30_top',
    'di_52_31_L1', 'di_52_31_L2', 'di_52_31_L3', 'di_52_31_top'
];

/**
 * Test results tracking
 */
class TestResults {
    constructor() {
        this.totalTests = 0;
        this.successfulPaths = 0;
        this.failedPaths = 0;
        this.errors = [];
        this.pathDetails = [];
        this.startTime = null;
        this.endTime = null;
    }

    start() {
        this.startTime = Date.now();
        console.log(`🚀 Starting comprehensive fossil-to-DI box path testing...`);
        console.log(`📊 Testing ${FOSSIL_FIXTURES.length} fossils × ${DI_BOX_FIXTURES.length} DI boxes = ${FOSSIL_FIXTURES.length * DI_BOX_FIXTURES.length} total combinations`);
    }

    recordResult(source, target, path, error = null) {
        this.totalTests++;
        
        if (error) {
            this.failedPaths++;
            this.errors.push({
                source,
                target,
                error: error.message
            });
        } else if (path) {
            this.successfulPaths++;
            const pathDetails = {
                source,
                target,
                pathLength: path.length,
                path: path,
                waypointsUsed: path.filter(nodeId => nodeId.startsWith('wp_')).length
            };
            this.pathDetails.push(pathDetails);
        } else {
            this.failedPaths++;
            this.errors.push({
                source,
                target,
                error: 'No path found'
            });
        }

        // Progress indicator
        if (this.totalTests % 100 === 0) {
            const progress = (this.totalTests / (FOSSIL_FIXTURES.length * DI_BOX_FIXTURES.length) * 100).toFixed(1);
            console.log(`📈 Progress: ${this.totalTests}/${FOSSIL_FIXTURES.length * DI_BOX_FIXTURES.length} (${progress}%) - Success: ${this.successfulPaths}, Failed: ${this.failedPaths}`);
        }
    }

    finish() {
        this.endTime = Date.now();
        const duration = this.endTime - this.startTime;
        
        console.log(`\n🎯 TESTING COMPLETE!`);
        console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)} seconds`);
        console.log(`📊 Total Tests: ${this.totalTests}`);
        console.log(`✅ Successful Paths: ${this.successfulPaths}`);
        console.log(`❌ Failed Paths: ${this.failedPaths}`);
        console.log(`📈 Success Rate: ${((this.successfulPaths / this.totalTests) * 100).toFixed(2)}%`);

        if (this.errors.length > 0) {
            console.log(`\n❌ FAILED PATHS (${this.errors.length}):`);
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.source} → ${error.target}: ${error.error}`);
            });
        }

        // Path statistics
        if (this.pathDetails.length > 0) {
            const pathLengths = this.pathDetails.map(p => p.pathLength);
            const waypointCounts = this.pathDetails.map(p => p.waypointsUsed);
            
            console.log(`\n📊 PATH STATISTICS:`);
            console.log(`   Average Path Length: ${(pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length).toFixed(2)} nodes`);
            console.log(`   Min Path Length: ${Math.min(...pathLengths)} nodes`);
            console.log(`   Max Path Length: ${Math.max(...pathLengths)} nodes`);
            console.log(`   Average Waypoints Used: ${(waypointCounts.reduce((a, b) => a + b, 0) / waypointCounts.length).toFixed(2)}`);
            console.log(`   Min Waypoints: ${Math.min(...waypointCounts)}`);
            console.log(`   Max Waypoints: ${Math.max(...waypointCounts)}`);
        }

        return {
            totalTests: this.totalTests,
            successfulPaths: this.successfulPaths,
            failedPaths: this.failedPaths,
            successRate: (this.successfulPaths / this.totalTests) * 100,
            duration: duration,
            errors: this.errors,
            pathDetails: this.pathDetails
        };
    }
}

/**
 * Main testing function
 */
async function testAllFossilToDiBoxPaths() {
    const results = new TestResults();
    results.start();

    try {
        // Load wayfinding data and build graph
        console.log(`\n📂 Loading wayfinding data...`);
        
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
            console.log(`   ✓ Loaded ${fixturePath.split('/').pop()} with ${data.features?.length || 0} features`);
        }
        
        // Build graph using the GraphBuilder directly
        const { GraphBuilder } = await import('../../data/loader.js');
        const builder = new GraphBuilder();
        const graph = builder.buildGraph(wayfindingData, fixtureData);

        console.log(`✅ Graph loaded successfully!`);
        console.log(`📊 Graph statistics:`, graph.getStatistics());

        // Verify all fixtures exist in the graph
        const missingFossils = FOSSIL_FIXTURES.filter(fossil => !graph.hasNode(fossil));
        const missingDiBoxes = DI_BOX_FIXTURES.filter(diBox => !graph.hasNode(diBox));

        if (missingFossils.length > 0) {
            console.warn(`⚠️  Missing fossil fixtures in graph: ${missingFossils.join(', ')}`);
        }
        if (missingDiBoxes.length > 0) {
            console.warn(`⚠️  Missing DI box fixtures in graph: ${missingDiBoxes.length} out of ${DI_BOX_FIXTURES.length}`);
        }

        // Create pathfinder
        const pathfinder = new Pathfinder(graph);

        console.log(`\n🔍 Starting path testing...`);

        // Test every fossil-to-DI box combination
        for (const fossil of FOSSIL_FIXTURES) {
            if (!graph.hasNode(fossil)) {
                console.warn(`⚠️  Fossil ${fossil} not found in graph, skipping...`);
                continue;
            }

            for (const diBox of DI_BOX_FIXTURES) {
                if (!graph.hasNode(diBox)) {
                    // Record as error but continue
                    results.recordResult(fossil, diBox, null, new Error(`DI box ${diBox} not found in graph`));
                    continue;
                }

                try {
                    const path = pathfinder.findPath(fossil, diBox);
                    results.recordResult(fossil, diBox, path);
                } catch (error) {
                    results.recordResult(fossil, diBox, null, error);
                }
            }
        }

        // Generate final report
        const finalResults = results.finish();
        
        // Save detailed results to file
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: finalResults.totalTests,
                successfulPaths: finalResults.successfulPaths,
                failedPaths: finalResults.failedPaths,
                successRate: finalResults.successRate,
                duration: finalResults.duration
            },
            fixtures: {
                fossils: FOSSIL_FIXTURES,
                diBoxes: DI_BOX_FIXTURES,
                missingFossils,
                missingDiBoxes
            },
            errors: finalResults.errors,
            samplePaths: finalResults.pathDetails.slice(0, 10) // First 10 successful paths as examples
        };

        // Write results to file
        const reportPath = './fossil-di-path-test-results.json';
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n💾 Detailed results saved to: ${reportPath}`);

        return finalResults;

    } catch (error) {
        console.error(`💥 Critical error during testing:`, error);
        throw error;
    }
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testAllFossilToDiBoxPaths()
        .then(results => {
            console.log(`\n🎉 Testing completed successfully!`);
            process.exit(0);
        })
        .catch(error => {
            console.error(`💥 Testing failed:`, error);
            process.exit(1);
        });
}

export { testAllFossilToDiBoxPaths, FOSSIL_FIXTURES, DI_BOX_FIXTURES };
