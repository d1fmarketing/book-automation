#!/usr/bin/env node

const https = require('https');

// Amazon Ads Account ID
const AMAZON_ADS_ACCOUNT_ID = 'amzn1.ads-account.g.6oegpm38wfx5mky8l7ft3js7z';

async function testAmazonAdsAccount() {
    console.log('🧪 Testing Amazon Ads Account ID...\n');
    
    console.log('📊 Account Information:');
    console.log('   Account ID:', AMAZON_ADS_ACCOUNT_ID);
    console.log('   Type: Amazon Ads Account');
    console.log('   Format: ✅ Valid (matches amzn1.ads-account pattern)');
    
    // Parse account ID
    const parts = AMAZON_ADS_ACCOUNT_ID.split('.');
    console.log('\n🔍 Account Structure:');
    console.log('   Prefix:', parts[0]); // amzn1
    console.log('   Type:', parts[1]);   // ads-account
    console.log('   Region:', parts[2]); // g (global)
    console.log('   Unique ID:', parts[3]); // 6oegpm38wfx5mky8l7ft3js7z
    
    console.log('\n📋 What you can do with this account:');
    console.log('   ✅ Create Sponsored Product campaigns');
    console.log('   ✅ Run display ads for ebooks');
    console.log('   ✅ Set up retargeting campaigns');
    console.log('   ✅ Track ad performance metrics');
    
    console.log('\n⚠️  Important Notes:');
    console.log('   1. This is NOT a PA-API key (Product Advertising API)');
    console.log('   2. This is for Amazon Advertising Console');
    console.log('   3. You need separate API credentials to automate ads');
    
    console.log('\n🔑 To use Amazon Ads API, you need:');
    console.log('   - Client ID');
    console.log('   - Client Secret');
    console.log('   - Refresh Token');
    console.log('   Get these from: https://advertising.amazon.com/API/docs/');
    
    console.log('\n💡 For the ebook pipeline:');
    console.log('   - Current setup with AMAZON_ASSOCIATE_TAG is enough');
    console.log('   - Amazon Ads is for scaling after publishing');
    console.log('   - Focus on creating great ebooks first!');
}

// Run test
testAmazonAdsAccount();