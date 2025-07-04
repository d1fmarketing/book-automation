#!/usr/bin/env node

/**
 * Test script for admin dashboard upload and refurbish features
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:4000/api';
let authToken = null;

async function login() {
    try {
        const response = await axios.post(`${API_BASE}/auth/login`, {
            password: 'admin123'
        });
        authToken = response.data.token;
        console.log('✅ Logged in successfully');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        return false;
    }
}

async function testFileUpload() {
    console.log('\n📤 Testing file upload...');
    
    // Create a test file
    const testContent = '# Test Chapter\n\nThis is a test chapter for upload functionality.';
    const testFile = path.join(__dirname, 'test-upload.md');
    fs.writeFileSync(testFile, testContent);
    
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(testFile));
        form.append('type', 'chapter');
        
        const response = await axios.post(`${API_BASE}/upload`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('✅ Upload successful:', response.data);
        
        // Clean up
        fs.unlinkSync(testFile);
        
        return true;
    } catch (error) {
        console.error('❌ Upload failed:', error.response?.data || error.message);
        return false;
    }
}

async function testRefurbishQueue() {
    console.log('\n🔄 Testing refurbish queue...');
    
    try {
        // Get queue stats
        const statsResponse = await axios.get(`${API_BASE}/queues/refurbish/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('📊 Queue stats:', statsResponse.data);
        
        // Test pause/resume
        console.log('\n⏸️  Testing pause...');
        await axios.post(`${API_BASE}/queues/refurbish/pause`, {}, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Queue paused');
        
        console.log('\n▶️  Testing resume...');
        await axios.post(`${API_BASE}/queues/refurbish/resume`, {}, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        console.log('✅ Queue resumed');
        
        return true;
    } catch (error) {
        console.error('❌ Refurbish queue test failed:', error.response?.data || error.message);
        return false;
    }
}

async function main() {
    console.log('🧪 Testing Admin Dashboard Features');
    console.log('===================================\n');
    
    // Check if server is running
    try {
        await axios.get(`${API_BASE}/status`);
    } catch (error) {
        console.error('❌ Admin server is not running on port 4000');
        console.log('💡 Start it with: cd admin && npm run dev');
        process.exit(1);
    }
    
    // Run tests
    if (!await login()) {
        process.exit(1);
    }
    
    const uploadSuccess = await testFileUpload();
    const refurbishSuccess = await testRefurbishQueue();
    
    console.log('\n📋 Test Results:');
    console.log(`   File Upload: ${uploadSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Refurbish Queue: ${refurbishSuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    if (uploadSuccess && refurbishSuccess) {
        console.log('\n✨ All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    }
}

// Check if axios is installed
try {
    require('axios');
    require('form-data');
} catch (error) {
    console.error('❌ Missing dependencies. Run: npm install axios form-data');
    process.exit(1);
}

main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});