#!/usr/bin/env node

/**
 * BrowserStack QA Agent
 * 
 * Performs cross-browser and cross-device testing for ebooks using BrowserStack.
 * Tests rendering, responsiveness, and functionality across different platforms.
 * 
 * Usage:
 *   agentcli call qa.browserstack --url="https://example.com/ebook" --devices="all"
 *   node agents/browserstack-qa.js --html-path="build/ebook.html" --report
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const webdriver = require('selenium-webdriver');
const { Builder, By, until, Capabilities } = webdriver;

// BrowserStack configuration
const BROWSERSTACK_CONFIG = {
    username: process.env.BROWSERSTACK_USERNAME,
    accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
    hub: 'https://hub-cloud.browserstack.com/wd/hub',
    
    // Test configurations for different device types
    devices: {
        desktop: [
            {
                name: 'Windows Chrome Latest',
                browserName: 'Chrome',
                browserVersion: 'latest',
                os: 'Windows',
                osVersion: '11',
                resolution: '1920x1080'
            },
            {
                name: 'macOS Safari Latest',
                browserName: 'Safari',
                browserVersion: 'latest',
                os: 'OS X',
                osVersion: 'Ventura',
                resolution: '1920x1080'
            },
            {
                name: 'Windows Edge Latest',
                browserName: 'Edge',
                browserVersion: 'latest',
                os: 'Windows',
                osVersion: '11',
                resolution: '1920x1080'
            }
        ],
        tablet: [
            {
                name: 'iPad Pro 12.9',
                device: 'iPad Pro 12.9 2022',
                realMobile: true,
                os: 'ios',
                osVersion: '16'
            },
            {
                name: 'Samsung Galaxy Tab S8',
                device: 'Samsung Galaxy Tab S8',
                realMobile: true,
                os: 'android',
                osVersion: '12.0'
            }
        ],
        mobile: [
            {
                name: 'iPhone 14 Pro Max',
                device: 'iPhone 14 Pro Max',
                realMobile: true,
                os: 'ios',
                osVersion: '16'
            },
            {
                name: 'Google Pixel 7',
                device: 'Google Pixel 7',
                realMobile: true,
                os: 'android',
                osVersion: '13.0'
            }
        ],
        ereader: [
            // Simulated e-reader viewport sizes
            {
                name: 'Kindle Paperwhite',
                browserName: 'Chrome',
                browserVersion: 'latest',
                os: 'Windows',
                osVersion: '11',
                resolution: '1072x1448',
                browserstack: {
                    console: 'errors',
                    networkLogs: true
                }
            },
            {
                name: 'Kobo Clara HD',
                browserName: 'Chrome',
                browserVersion: 'latest',
                os: 'Windows',
                osVersion: '11',
                resolution: '1072x1448'
            }
        ]
    }
};

// Test scenarios
const TEST_SCENARIOS = {
    rendering: {
        name: 'Visual Rendering',
        priority: 'high',
        tests: [
            'checkPageLoad',
            'checkImageRendering',
            'checkFontLoading',
            'checkLayoutIntegrity'
        ]
    },
    responsiveness: {
        name: 'Responsive Design',
        priority: 'high',
        tests: [
            'checkViewportAdaptation',
            'checkTextReflow',
            'checkImageScaling',
            'checkNavigationUsability'
        ]
    },
    performance: {
        name: 'Performance Metrics',
        priority: 'medium',
        tests: [
            'measureLoadTime',
            'checkScrollPerformance',
            'measureMemoryUsage',
            'checkOfflineCapability'
        ]
    },
    accessibility: {
        name: 'Accessibility Compliance',
        priority: 'high',
        tests: [
            'checkContrastRatios',
            'checkFontSizes',
            'checkTouchTargets',
            'checkAltTexts'
        ]
    }
};

class BrowserStackQA {
    constructor(options = {}) {
        this.username = options.username || BROWSERSTACK_CONFIG.username;
        this.accessKey = options.accessKey || BROWSERSTACK_CONFIG.accessKey;
        
        if (!this.username || !this.accessKey) {
            throw new Error('BrowserStack credentials required. Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY');
        }
        
        this.testUrl = options.url;
        this.localTesting = options.local || false;
        this.screenshots = options.screenshots !== false;
        this.deviceTypes = options.devices || ['desktop', 'mobile'];
        this.testScenarios = options.scenarios || Object.keys(TEST_SCENARIOS);
        
        this.results = {
            timestamp: new Date().toISOString(),
            url: this.testUrl,
            devices: {},
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };
    }

    async testEbook(url) {
        console.log('🔍 Starting BrowserStack QA Testing');
        console.log(`📱 Testing URL: ${url}`);
        console.log(`🖥️  Device types: ${this.deviceTypes.join(', ')}`);
        console.log('');
        
        this.testUrl = url;
        
        try {
            // If local file, upload to temporary hosting
            if (this.localTesting || url.startsWith('file://')) {
                console.log('⚠️  Local testing detected. Setting up BrowserStack Local...');
                await this.setupLocalTesting();
            }
            
            // Run tests for each device type
            for (const deviceType of this.deviceTypes) {
                console.log(`\n📱 Testing on ${deviceType} devices...`);
                console.log('-'.repeat(40));
                
                const devices = BROWSERSTACK_CONFIG.devices[deviceType] || [];
                
                for (const device of devices) {
                    await this.testDevice(device, deviceType);
                }
            }
            
            // Generate comprehensive report
            await this.generateReport();
            
            // Determine overall pass/fail
            const passRate = this.results.summary.passed / this.results.summary.total;
            const success = passRate >= 0.9; // 90% pass rate required
            
            console.log('\n📊 QA SUMMARY');
            console.log('='.repeat(50));
            console.log(`✅ Passed: ${this.results.summary.passed}/${this.results.summary.total}`);
            console.log(`❌ Failed: ${this.results.summary.failed}/${this.results.summary.total}`);
            console.log(`⚠️  Warnings: ${this.results.summary.warnings}`);
            console.log(`📈 Pass rate: ${(passRate * 100).toFixed(1)}%`);
            console.log(`🎯 Status: ${success ? 'PASSED' : 'FAILED'}`);
            
            return {
                success,
                passRate,
                results: this.results,
                reportPath: this.reportPath
            };
            
        } catch (error) {
            console.error('❌ BrowserStack QA failed:', error.message);
            return {
                success: false,
                error: error.message,
                results: this.results
            };
        } finally {
            if (this.localTesting) {
                await this.teardownLocalTesting();
            }
        }
    }

    async testDevice(deviceConfig, deviceType) {
        console.log(`\n🔧 Testing on: ${deviceConfig.name}`);
        
        let driver;
        const deviceResults = {
            device: deviceConfig.name,
            type: deviceType,
            tests: {},
            screenshots: [],
            passed: 0,
            failed: 0
        };
        
        try {
            // Build capabilities
            const capabilities = this.buildCapabilities(deviceConfig);
            
            // Create driver
            driver = await new Builder()
                .usingServer(BROWSERSTACK_CONFIG.hub)
                .withCapabilities(capabilities)
                .build();
            
            // Navigate to test URL
            await driver.get(this.testUrl);
            
            // Wait for page load
            await driver.wait(until.elementLocated(By.tagName('body')), 10000);
            
            // Run test scenarios
            for (const scenarioKey of this.testScenarios) {
                const scenario = TEST_SCENARIOS[scenarioKey];
                if (!scenario) continue;
                
                console.log(`  📋 Running ${scenario.name} tests...`);
                
                for (const testName of scenario.tests) {
                    try {
                        const result = await this.runTest(driver, testName, deviceConfig);
                        deviceResults.tests[testName] = result;
                        
                        if (result.passed) {
                            deviceResults.passed++;
                            console.log(`    ✅ ${testName}: ${result.message}`);
                        } else {
                            deviceResults.failed++;
                            console.log(`    ❌ ${testName}: ${result.message}`);
                        }
                        
                        this.results.summary.total++;
                        if (result.passed) {
                            this.results.summary.passed++;
                        } else {
                            this.results.summary.failed++;
                        }
                        
                    } catch (error) {
                        console.log(`    ⚠️  ${testName}: ${error.message}`);
                        deviceResults.tests[testName] = {
                            passed: false,
                            message: error.message,
                            error: true
                        };
                        deviceResults.failed++;
                        this.results.summary.failed++;
                        this.results.summary.total++;
                    }
                }
            }
            
            // Take final screenshot
            if (this.screenshots) {
                const screenshot = await driver.takeScreenshot();
                deviceResults.screenshots.push({
                    name: 'final',
                    data: screenshot,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error(`  ❌ Device test failed: ${error.message}`);
            deviceResults.error = error.message;
        } finally {
            if (driver) {
                await driver.quit();
            }
        }
        
        // Store device results
        const deviceKey = `${deviceType}_${deviceConfig.name.replace(/\s+/g, '_')}`;
        this.results.devices[deviceKey] = deviceResults;
        
        return deviceResults;
    }

    buildCapabilities(deviceConfig) {
        const caps = {
            'browserstack.user': this.username,
            'browserstack.key': this.accessKey,
            'project': 'Ebook QA',
            'build': `QA Build ${new Date().toISOString()}`,
            'name': `${deviceConfig.name} Test`,
            'browserstack.debug': true,
            'browserstack.console': 'errors',
            'browserstack.networkLogs': true
        };
        
        // Add device-specific capabilities
        Object.keys(deviceConfig).forEach(key => {
            if (key !== 'name') {
                caps[key] = deviceConfig[key];
            }
        });
        
        // Add local testing if enabled
        if (this.localTesting) {
            caps['browserstack.local'] = true;
        }
        
        return caps;
    }

    async runTest(driver, testName, deviceConfig) {
        // Map test names to actual test implementations
        const testMap = {
            // Rendering tests
            checkPageLoad: async () => {
                const body = await driver.findElement(By.tagName('body'));
                const displayed = await body.isDisplayed();
                return {
                    passed: displayed,
                    message: displayed ? 'Page loaded successfully' : 'Page failed to load'
                };
            },
            
            checkImageRendering: async () => {
                const images = await driver.findElements(By.tagName('img'));
                let loaded = 0;
                let total = images.length;
                
                for (const img of images) {
                    const naturalWidth = await driver.executeScript(
                        'return arguments[0].naturalWidth', img
                    );
                    if (naturalWidth > 0) loaded++;
                }
                
                return {
                    passed: loaded === total,
                    message: `${loaded}/${total} images loaded`,
                    warning: loaded > 0 && loaded < total
                };
            },
            
            checkFontLoading: async () => {
                const fontStatus = await driver.executeScript(`
                    return document.fonts.ready.then(() => {
                        return {
                            loaded: document.fonts.size,
                            status: document.fonts.status
                        };
                    });
                `);
                
                return {
                    passed: fontStatus.status === 'loaded',
                    message: `${fontStatus.loaded} fonts loaded`
                };
            },
            
            checkLayoutIntegrity: async () => {
                const overflows = await driver.executeScript(`
                    const elements = document.querySelectorAll('*');
                    let overflowing = [];
                    elements.forEach(el => {
                        if (el.scrollWidth > el.clientWidth || 
                            el.scrollHeight > el.clientHeight) {
                            overflowing.push(el.tagName);
                        }
                    });
                    return overflowing;
                `);
                
                return {
                    passed: overflows.length === 0,
                    message: overflows.length > 0 ? 
                        `${overflows.length} elements overflowing` : 
                        'No layout issues detected'
                };
            },
            
            // Responsiveness tests
            checkViewportAdaptation: async () => {
                const viewport = await driver.executeScript(
                    'return {width: window.innerWidth, height: window.innerHeight}'
                );
                const bodyWidth = await driver.executeScript(
                    'return document.body.scrollWidth'
                );
                
                const adapted = bodyWidth <= viewport.width;
                return {
                    passed: adapted,
                    message: adapted ? 
                        'Content adapts to viewport' : 
                        'Horizontal scrolling detected'
                };
            },
            
            checkTextReflow: async () => {
                const readability = await driver.executeScript(`
                    const paragraphs = document.querySelectorAll('p');
                    let tooWide = 0;
                    paragraphs.forEach(p => {
                        const width = p.getBoundingClientRect().width;
                        const fontSize = parseFloat(getComputedStyle(p).fontSize);
                        const charsPerLine = width / (fontSize * 0.5);
                        if (charsPerLine > 75) tooWide++;
                    });
                    return {
                        total: paragraphs.length,
                        tooWide: tooWide
                    };
                `);
                
                return {
                    passed: readability.tooWide === 0,
                    message: readability.tooWide > 0 ?
                        `${readability.tooWide} paragraphs too wide for comfortable reading` :
                        'Text width optimized for reading'
                };
            },
            
            // Performance tests
            measureLoadTime: async () => {
                const timing = await driver.executeScript(
                    'return window.performance.timing'
                );
                const loadTime = timing.loadEventEnd - timing.navigationStart;
                
                return {
                    passed: loadTime < 3000, // 3 second threshold
                    message: `Page loaded in ${loadTime}ms`,
                    metric: loadTime
                };
            },
            
            checkScrollPerformance: async () => {
                const fps = await driver.executeScript(`
                    return new Promise(resolve => {
                        let frames = 0;
                        let lastTime = performance.now();
                        
                        function measureFrame() {
                            frames++;
                            const currentTime = performance.now();
                            
                            if (currentTime - lastTime >= 1000) {
                                resolve(frames);
                            } else {
                                requestAnimationFrame(measureFrame);
                            }
                        }
                        
                        // Trigger scroll
                        window.scrollTo(0, 100);
                        measureFrame();
                    });
                `);
                
                return {
                    passed: fps >= 30,
                    message: `Scroll performance: ${fps} FPS`,
                    metric: fps
                };
            },
            
            // Accessibility tests
            checkContrastRatios: async () => {
                const results = await driver.executeScript(`
                    function getContrast(rgb1, rgb2) {
                        const lum1 = getLuminance(rgb1);
                        const lum2 = getLuminance(rgb2);
                        const brightest = Math.max(lum1, lum2);
                        const darkest = Math.min(lum1, lum2);
                        return (brightest + 0.05) / (darkest + 0.05);
                    }
                    
                    function getLuminance(rgb) {
                        const [r, g, b] = rgb.match(/\\d+/g).map(Number);
                        const [rs, gs, bs] = [r, g, b].map(c => {
                            c = c / 255;
                            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
                        });
                        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
                    }
                    
                    const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a');
                    let lowContrast = 0;
                    
                    elements.forEach(el => {
                        const style = getComputedStyle(el);
                        const bg = style.backgroundColor || 'rgb(255, 255, 255)';
                        const fg = style.color || 'rgb(0, 0, 0)';
                        
                        if (bg.includes('rgb') && fg.includes('rgb')) {
                            const contrast = getContrast(bg, fg);
                            if (contrast < 4.5) lowContrast++;
                        }
                    });
                    
                    return {
                        total: elements.length,
                        lowContrast: lowContrast
                    };
                `);
                
                return {
                    passed: results.lowContrast === 0,
                    message: results.lowContrast > 0 ?
                        `${results.lowContrast} elements with poor contrast` :
                        'All text has sufficient contrast'
                };
            },
            
            checkTouchTargets: async () => {
                const results = await driver.executeScript(`
                    const clickables = document.querySelectorAll('a, button, input, select, textarea');
                    let tooSmall = 0;
                    
                    clickables.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width < 44 || rect.height < 44) {
                            tooSmall++;
                        }
                    });
                    
                    return {
                        total: clickables.length,
                        tooSmall: tooSmall
                    };
                `);
                
                return {
                    passed: results.tooSmall === 0,
                    message: results.tooSmall > 0 ?
                        `${results.tooSmall} touch targets too small (min 44x44px)` :
                        'All touch targets adequately sized'
                };
            }
        };
        
        // Execute the test
        const testFunction = testMap[testName];
        if (!testFunction) {
            return {
                passed: false,
                message: `Test ${testName} not implemented`,
                skipped: true
            };
        }
        
        return await testFunction();
    }

    async setupLocalTesting() {
        // In production, this would start BrowserStack Local binary
        console.log('📡 BrowserStack Local testing configured');
        
        // For demo purposes, we'll upload to a temporary server
        if (this.testUrl.startsWith('file://')) {
            console.log('⚠️  Converting local file to hosted URL...');
            // In production: upload to temporary hosting or use BrowserStack Local
            this.testUrl = this.testUrl.replace('file://', 'http://localhost:8080/');
        }
    }

    async teardownLocalTesting() {
        console.log('🔌 Closing BrowserStack Local connection');
    }

    async generateReport() {
        // Create detailed HTML report
        const reportHtml = this.generateHTMLReport();
        
        // Save report
        const reportDir = 'build/qa-reports';
        await fs.mkdir(reportDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.reportPath = path.join(reportDir, `browserstack-qa-${timestamp}.html`);
        
        await fs.writeFile(this.reportPath, reportHtml);
        
        // Also save JSON results
        const jsonPath = this.reportPath.replace('.html', '.json');
        await fs.writeFile(jsonPath, JSON.stringify(this.results, null, 2));
        
        console.log(`\n📄 Report saved to: ${this.reportPath}`);
    }

    generateHTMLReport() {
        const { devices, summary } = this.results;
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BrowserStack QA Report - ${new Date().toLocaleDateString()}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        h1 {
            margin: 0;
            color: #333;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin: 10px 0;
        }
        .passed { color: #4CAF50; }
        .failed { color: #f44336; }
        .warning { color: #ff9800; }
        .device-results {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .test-result {
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-passed {
            background: #E8F5E9;
            color: #2E7D32;
        }
        .test-failed {
            background: #FFEBEE;
            color: #C62828;
        }
        .screenshot {
            max-width: 300px;
            margin: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .device-type {
            display: inline-block;
            padding: 5px 10px;
            background: #E3F2FD;
            color: #1976D2;
            border-radius: 20px;
            font-size: 0.9em;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 BrowserStack QA Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>URL Tested: <a href="${this.testUrl}">${this.testUrl}</a></p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-label">Total Tests</div>
            <div class="metric-value">${summary.total}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Passed</div>
            <div class="metric-value passed">${summary.passed}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Failed</div>
            <div class="metric-value failed">${summary.failed}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Pass Rate</div>
            <div class="metric-value ${summary.passed/summary.total >= 0.9 ? 'passed' : 'failed'}">
                ${((summary.passed/summary.total) * 100).toFixed(1)}%
            </div>
        </div>
    </div>
    
    <h2>Device Test Results</h2>
    ${Object.entries(devices).map(([key, device]) => `
        <div class="device-results">
            <h3>${device.device} <span class="device-type">${device.type}</span></h3>
            <p>✅ Passed: ${device.passed} | ❌ Failed: ${device.failed}</p>
            
            <div class="tests">
                ${Object.entries(device.tests).map(([testName, result]) => `
                    <div class="test-result ${result.passed ? 'test-passed' : 'test-failed'}">
                        <span>${testName.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span>${result.message}</span>
                    </div>
                `).join('')}
            </div>
            
            ${device.screenshots && device.screenshots.length > 0 ? `
                <h4>Screenshots</h4>
                <div class="screenshots">
                    ${device.screenshots.map(s => `
                        <img src="data:image/png;base64,${s.data}" 
                             alt="${s.name}" 
                             class="screenshot" />
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('')}
    
    <div class="footer" style="text-align: center; margin-top: 50px; color: #666;">
        <p>Generated by BrowserStack QA Agent</p>
    </div>
</body>
</html>`;
    }

    async testLocalFile(filePath) {
        // For local HTML files, start a simple server
        const express = require('express');
        const app = express();
        const port = 8080;
        
        app.use(express.static(path.dirname(filePath)));
        
        const server = app.listen(port, () => {
            console.log(`🌐 Local server started at http://localhost:${port}`);
        });
        
        try {
            const fileName = path.basename(filePath);
            const result = await this.testEbook(`http://localhost:${port}/${fileName}`);
            return result;
        } finally {
            server.close();
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    args.forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value || true;
        }
    });
    
    if (!options.url && !options['html-path']) {
        console.error('Usage: browserstack-qa.js --url="https://example.com/ebook"');
        console.error('   or: browserstack-qa.js --html-path="path/to/ebook.html"');
        console.error('\nOptions:');
        console.error('  --devices    Device types to test (desktop,tablet,mobile,ereader)');
        console.error('  --scenarios  Test scenarios to run (rendering,responsiveness,performance,accessibility)');
        console.error('  --report     Generate detailed HTML report');
        console.error('  --local      Use BrowserStack Local for testing');
        process.exit(1);
    }
    
    const tester = new BrowserStackQA({
        devices: options.devices ? options.devices.split(',') : undefined,
        scenarios: options.scenarios ? options.scenarios.split(',') : undefined,
        screenshots: options.screenshots !== 'false'
    });
    
    (async () => {
        try {
            let result;
            
            if (options['html-path']) {
                result = await tester.testLocalFile(options['html-path']);
            } else {
                result = await tester.testEbook(options.url);
            }
            
            process.exit(result.success ? 0 : 1);
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = BrowserStackQA;