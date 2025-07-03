#!/usr/bin/env node

// Script to add PWA support to all UIs

const fs = require('fs').promises;
const path = require('path');

const UIS = [
    { name: 'Dashboard', path: 'dashboard/index.html' },
    { name: 'Reader', path: 'reader/index.html' },
    { name: 'Analytics', path: 'analytics/index.html' },
    { name: 'Control Panel', path: 'control-panel/index.html' },
    { name: 'Template Builder', path: 'template-builder/index.html' }
];

async function addPWASupport() {
    console.log('🚀 Adding PWA support to all UIs...\n');

    for (const ui of UIS) {
        try {
            console.log(`📱 Processing ${ui.name}...`);
            
            const filePath = path.join(process.cwd(), ui.path);
            let content = await fs.readFile(filePath, 'utf8');
            
            // Check if already has PWA support
            if (content.includes('manifest.json') || content.includes('pwa-register.js')) {
                console.log(`   ✅ Already has PWA support`);
                continue;
            }
            
            // Add PWA meta tags after <title>
            const pwaMetaTags = `
    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#2563eb">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Money Machine">
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="/manifest.json">
    
    <!-- Mobile Responsive CSS -->
    <link rel="stylesheet" href="/mobile-responsive.css">`;
            
            // Add before closing </head>
            const pwaScripts = `
    <!-- PWA Support -->
    <script src="/pwa-register.js"></script>
    <script src="/mobile-menu.js"></script>`;
            
            // Insert PWA meta tags
            content = content.replace(
                /<\/title>/,
                `</title>${pwaMetaTags}`
            );
            
            // Insert PWA scripts before </head>
            content = content.replace(
                /<\/head>/,
                `${pwaScripts}\n</head>`
            );
            
            // Update viewport meta tag to be more mobile-friendly
            content = content.replace(
                /<meta name="viewport"[^>]*>/,
                '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">'
            );
            
            // Save updated file
            await fs.writeFile(filePath, content);
            console.log(`   ✅ PWA support added`);
            
        } catch (error) {
            console.error(`   ❌ Error processing ${ui.name}:`, error.message);
        }
    }
    
    console.log('\n✅ PWA support added to all UIs!');
    console.log('\n📝 Next steps:');
    console.log('   1. Create icon files in /icons/ directory');
    console.log('   2. Test on mobile devices');
    console.log('   3. Deploy with HTTPS for full PWA features');
}

// Run the script
addPWASupport().catch(console.error);