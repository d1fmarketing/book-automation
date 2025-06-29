#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
// Simple console colors without colors
const colors = {
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// Visual analysis configuration
const ANALYSIS_CONFIG = {
    elementsToCheck: [
        { selector: '.tip-box', name: 'Tip Boxes', expectedBg: 'rgba(78, 205, 196, 0.15)' },
        { selector: '.warning-box', name: 'Warning Boxes', expectedBg: 'rgba(255, 107, 107, 0.15)' },
        { selector: '.checklist', name: 'Checklists', expectedBg: 'rgb(248, 249, 250)' },
        { selector: 'h1', name: 'Main Headings', expectedColor: 'rgb(78, 205, 196)' },
        { selector: 'h2', name: 'Subheadings', expectedColor: 'rgb(255, 107, 107)' },
        { selector: '.chapter > p:first-of-type', name: 'First Letter', checkFirstLetter: true },
        { selector: 'img', name: 'Images', checkVisibility: true },
        { selector: '.cover', name: 'Cover Page', checkGradient: true }
    ],
    screenshotDir: 'build/visual-report/screenshots',
    reportDir: 'build/visual-report'
};

async function initializePuppeteer() {
    console.log(colors.blue('🚀 Initializing Puppeteer MCP...'));
    
    const browser = await puppeteer.launch({
        headless: false, // Show browser for visual debugging
        devtools: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--force-color-profile=srgb',
            '--enable-logging',
            '--v=1'
        ]
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
        console.log(colors.gray(`Browser console: ${msg.text()}`));
    });
    
    page.on('pageerror', error => {
        console.log(colors.red(`Page error: ${error.message}`));
    });
    
    return { browser, page };
}

async function analyzeElement(page, config) {
    const result = await page.evaluate((selector) => {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) return { found: false };
        
        const firstEl = elements[0];
        const computed = window.getComputedStyle(firstEl);
        const rect = firstEl.getBoundingClientRect();
        
        return {
            found: true,
            count: elements.length,
            computed: {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                border: computed.border,
                borderRadius: computed.borderRadius,
                padding: computed.padding,
                margin: computed.margin,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                display: computed.display,
                position: computed.position,
                width: computed.width,
                height: computed.height
            },
            rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            },
            innerHTML: firstEl.innerHTML.substring(0, 200),
            className: firstEl.className
        };
    }, config.selector);
    
    return result;
}

async function captureElementScreenshot(page, selector, name) {
    try {
        const element = await page.$(selector);
        if (!element) return null;
        
        const filename = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
        const filepath = path.join(ANALYSIS_CONFIG.screenshotDir, filename);
        
        await element.screenshot({ path: filepath });
        return filename;
    } catch (error) {
        console.log(colors.yellow(`⚠️ Could not capture screenshot for ${name}: ${error.message}`));
        return null;
    }
}

async function analyzeFirstLetter(page, selector) {
    return await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return null;
        
        // Check if ::first-letter pseudo-element has styles
        const firstLetterStyles = window.getComputedStyle(element, '::first-letter');
        
        return {
            fontSize: firstLetterStyles.fontSize,
            color: firstLetterStyles.color,
            float: firstLetterStyles.float,
            lineHeight: firstLetterStyles.lineHeight
        };
    }, selector);
}

async function generateHTMLReport(analysisResults) {
    const reportPath = path.join(ANALYSIS_CONFIG.reportDir, 'index.html');
    
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Visual Analysis Report - ADHD Book PDF</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        
        .header {
            background: linear-gradient(135deg, #4ECDC4 0%, #95E1D3 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .summary {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin: 20px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            color: #4ECDC4;
        }
        
        .stat-label {
            color: #666;
            font-size: 14px;
        }
        
        .element-analysis {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin: 20px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .element-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .status-badge {
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .status-pass {
            background: #d4edda;
            color: #155724;
        }
        
        .status-fail {
            background: #f8d7da;
            color: #721c24;
        }
        
        .status-warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .screenshot-container {
            margin: 20px 0;
            text-align: center;
        }
        
        .screenshot {
            max-width: 100%;
            border: 1px solid #ddd;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .css-properties {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
        }
        
        .issue {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 10px 0;
        }
        
        .fix {
            background: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 15px;
            margin: 10px 0;
        }
        
        code {
            background: #e9ecef;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 MCP Visual Analysis Report</h1>
        <p>ADHD Book PDF - Visual Element Analysis</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="container">
        <div class="summary">
            <h2>📊 Analysis Summary</h2>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${analysisResults.filter(r => r.status === 'pass').length}</div>
                    <div class="stat-label">Elements Correct</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysisResults.filter(r => r.status === 'fail').length}</div>
                    <div class="stat-label">Elements with Issues</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysisResults.filter(r => r.status === 'warning').length}</div>
                    <div class="stat-label">Warnings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysisResults.reduce((acc, r) => acc + (r.count || 0), 0)}</div>
                    <div class="stat-label">Total Elements Found</div>
                </div>
            </div>
        </div>
        
        ${analysisResults.map(result => `
            <div class="element-analysis">
                <div class="element-header">
                    <h3>${result.name}</h3>
                    <span class="status-badge status-${result.status}">${result.status.toUpperCase()}</span>
                </div>
                
                ${result.screenshot ? `
                    <div class="screenshot-container">
                        <img src="screenshots/${result.screenshot}" alt="${result.name} screenshot" class="screenshot">
                    </div>
                ` : ''}
                
                ${result.issues.length > 0 ? `
                    <h4>❌ Issues Found:</h4>
                    ${result.issues.map(issue => `
                        <div class="issue">
                            <strong>${issue.type}:</strong> ${issue.description}
                            <br>Expected: <code>${issue.expected}</code>
                            <br>Actual: <code>${issue.actual}</code>
                        </div>
                    `).join('')}
                ` : ''}
                
                ${result.fixes.length > 0 ? `
                    <h4>💡 Suggested Fixes:</h4>
                    ${result.fixes.map(fix => `
                        <div class="fix">
                            ${fix}
                        </div>
                    `).join('')}
                ` : ''}
                
                <details>
                    <summary>View CSS Properties</summary>
                    <div class="css-properties">
                        ${JSON.stringify(result.computed, null, 2)}
                    </div>
                </details>
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
    
    await fs.writeFile(reportPath, html);
    console.log(colors.green(`✅ Report generated: ${reportPath}`));
}

async function analyzeADHDBook() {
    // Setup directories
    await fs.ensureDir(ANALYSIS_CONFIG.screenshotDir);
    await fs.ensureDir(ANALYSIS_CONFIG.reportDir);
    
    const { browser, page } = await initializePuppeteer();
    const analysisResults = [];
    
    try {
        // Load the HTML file
        const htmlPath = path.resolve('build/temp/adhd-book-ultimate.html');
        console.log(colors.blue(`📄 Loading HTML: ${htmlPath}`));
        
        await page.goto(`file://${htmlPath}`, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000
        });
        
        // Wait for content to render
        await page.waitForTimeout(2000);
        
        // Analyze each element type
        for (const config of ANALYSIS_CONFIG.elementsToCheck) {
            console.log(colors.blue(`\n🔍 Analyzing: ${config.name}`));
            
            const analysis = await analyzeElement(page, config);
            const result = {
                name: config.name,
                selector: config.selector,
                found: analysis.found,
                count: analysis.count || 0,
                computed: analysis.computed || {},
                issues: [],
                fixes: [],
                status: 'pass'
            };
            
            if (!analysis.found) {
                result.status = 'fail';
                result.issues.push({
                    type: 'Not Found',
                    description: `No elements matching selector "${config.selector}"`,
                    expected: 'Elements to exist',
                    actual: 'Not found'
                });
            } else {
                // Take screenshot
                result.screenshot = await captureElementScreenshot(page, config.selector, config.name);
                
                // Check expected properties
                if (config.expectedBg && analysis.computed.backgroundColor !== config.expectedBg) {
                    result.status = 'fail';
                    result.issues.push({
                        type: 'Background Color',
                        description: 'Background color does not match expected',
                        expected: config.expectedBg,
                        actual: analysis.computed.backgroundColor
                    });
                    result.fixes.push(`Add inline style: style="background-color: ${config.expectedBg} !important;"`);
                }
                
                if (config.expectedColor && analysis.computed.color !== config.expectedColor) {
                    result.status = 'fail';
                    result.issues.push({
                        type: 'Text Color',
                        description: 'Text color does not match expected',
                        expected: config.expectedColor,
                        actual: analysis.computed.color
                    });
                    result.fixes.push(`Add inline style: style="color: ${config.expectedColor} !important;"`);
                }
                
                // Check first letter styling
                if (config.checkFirstLetter) {
                    const firstLetterStyles = await analyzeFirstLetter(page, config.selector);
                    if (firstLetterStyles && firstLetterStyles.fontSize === analysis.computed.fontSize) {
                        result.status = 'warning';
                        result.issues.push({
                            type: 'First Letter',
                            description: 'First letter pseudo-element may not be styled',
                            expected: 'Larger first letter',
                            actual: 'Same size as text'
                        });
                        result.fixes.push('Consider using a real span element instead of ::first-letter for PDF compatibility');
                    }
                }
                
                // Check image visibility
                if (config.checkVisibility) {
                    const imgCheck = await page.evaluate((selector) => {
                        const imgs = document.querySelectorAll(selector);
                        const brokenImages = [];
                        imgs.forEach((img, i) => {
                            if (!img.complete || img.naturalHeight === 0) {
                                brokenImages.push(i);
                            }
                        });
                        return { total: imgs.length, broken: brokenImages };
                    }, config.selector);
                    
                    if (imgCheck.broken.length > 0) {
                        result.status = 'fail';
                        result.issues.push({
                            type: 'Broken Images',
                            description: `${imgCheck.broken.length} images failed to load`,
                            expected: 'All images visible',
                            actual: `${imgCheck.broken.length} broken`
                        });
                        result.fixes.push('Check image paths are absolute file:// URLs');
                    }
                }
            }
            
            analysisResults.push(result);
            console.log(colors[result.status === 'pass' ? 'green' : result.status === 'warning' ? 'yellow' : 'red'](
                `  ${result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'} ${config.name}: ${result.status}`
            ));
        }
        
        // Generate report
        await generateHTMLReport(analysisResults);
        
        // Show summary
        console.log(colors.blue('\n📊 Analysis Complete:'));
        console.log(colors.green(`  ✅ Passed: ${analysisResults.filter(r => r.status === 'pass').length}`));
        console.log(colors.yellow(`  ⚠️ Warnings: ${analysisResults.filter(r => r.status === 'warning').length}`));
        console.log(colors.red(`  ❌ Failed: ${analysisResults.filter(r => r.status === 'fail').length}`));
        
        // Keep browser open for manual inspection
        console.log(colors.blue('\n👀 Browser window kept open for manual inspection.'));
        console.log(colors.gray('Press Ctrl+C to close when done.'));
        
        // Wait indefinitely
        await new Promise(() => {});
        
    } catch (error) {
        console.error(colors.red('❌ Error during analysis:'), error);
    } finally {
        // Browser will close when process exits
    }
}

// Run analysis
analyzeADHDBook().catch(console.error);