// Simple debug script to test search functionality
// Run this in the browser console or as a standalone script

console.log('🔍 Debug Search System');

// Test the data loading first
async function debugDataLoader() {
    try {
        console.log('Testing GeoJSON data loader...');
        
        // Import the data loader
        const { GeoJSONDataLoader } = await import('./src/search/geojson-data-loader.js');
        
        // Create wayfinding preset
        const dataLoader = GeoJSONDataLoader.createPreset('wayfinding');
        
        // Load one file first
        const data = await dataLoader.loadFromUrl('./public/geojson/cabinet_fixtures.geojson');
        
        console.log(`✅ Loaded ${data.length} items`);
        console.log('📊 First item:', data[0]);
        console.log('🔑 Available fields:', Object.keys(data[0]));
        
        // Test a few searches manually
        const testItems = data.slice(0, 5);
        console.log('🧪 Test items for manual search:');
        testItems.forEach((item, i) => {
            console.log(`  ${i + 1}. ID: ${item.id}, Name: ${item.name}, Alt: ${item.alt_name}, Type: ${item.type}`);
        });
        
        return data;
        
    } catch (error) {
        console.error('❌ Data loader failed:', error);
        return null;
    }
}

async function debugSearchProvider(data) {
    try {
        console.log('Testing Fuse.js search provider...');
        
        // Import the search provider
        const { createSearchProvider } = await import('./src/search/fuse-search-provider.js');
        
        // Create provider
        const searchProvider = await createSearchProvider('fuse');
        
        // Initialize with more lenient settings
        await searchProvider.initialize(data, {
            threshold: 0.8, // Very lenient
            minQueryLength: 1,
            includeScore: true,
            includeMatches: true
        });
        
        console.log('✅ Search provider initialized');
        
        // Test searches
        const testQueries = ['cabinet', 'col_1', 'Column', 'furniture', 'cab'];
        
        for (const query of testQueries) {
            console.log(`\n🔍 Testing query: "${query}"`);
            const results = searchProvider.search(query);
            console.log(`   Found ${results.length} results`);
            
            if (results.length > 0) {
                results.slice(0, 3).forEach((result, i) => {
                    console.log(`   ${i + 1}. ${result.item.id} (score: ${result.score.toFixed(3)})`);
                    if (result.matches) {
                        console.log(`      Matches: ${result.matches.map(m => `${m.key}="${m.value}"`).join(', ')}`);
                    }
                });
            } else {
                console.log('   ❌ No results found');
            }
        }
        
        return searchProvider;
        
    } catch (error) {
        console.error('❌ Search provider failed:', error);
        return null;
    }
}

// Main debug function
async function runDebug() {
    console.log('🚀 Starting debug session...');
    
    // Test data loading
    const data = await debugDataLoader();
    if (!data) return;
    
    // Test search
    const searchProvider = await debugSearchProvider(data);
    if (!searchProvider) return;
    
    console.log('✅ Debug complete! Both data loading and search are working.');
    
    // Make available globally for manual testing
    window.debugData = data;
    window.debugSearch = searchProvider;
    
    console.log('💡 Available for manual testing:');
    console.log('   window.debugData - loaded data');
    console.log('   window.debugSearch - search provider');
    console.log('   Example: window.debugSearch.search("cabinet")');
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
    runDebug();
}

// Export for Node.js testing
if (typeof module !== 'undefined') {
    module.exports = { runDebug };
}
