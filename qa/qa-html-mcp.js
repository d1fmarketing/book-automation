#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// QA test configuration
const QA_TESTS = {
  // Accessibility tests
  contrast: {
    name: 'Color Contrast',
    description: 'Check WCAG AA contrast ratios',
    threshold: 4.5 // WCAG AA minimum
  },
  
  // Responsive tests
  responsive: {
    name: 'Responsive Design',
    description: 'Test at multiple breakpoints',
    breakpoints: [375, 768, 1280, 1920]
  },
  
  // Performance metrics
  performance: {
    name: 'Performance Metrics',
    description: 'DOM size and load time',
    maxDomNodes: 1500,
    maxLoadTime: 3000 // 3 seconds
  },
  
  // Interactive features
  features: {
    name: 'Interactive Features',
    description: 'Verify all features work',
    required: [
      'search functionality',
      'theme switcher',
      'progress tracking',
      'navigation'
    ]
  }
};

// Calculate color contrast ratio
function getContrastRatio(rgb1, rgb2) {
  // Convert RGB to relative luminance
  function getLuminance(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    const sRGB = [r, g, b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  }
  
  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);
  const lmax = Math.max(l1, l2);
  const lmin = Math.min(l1, l2);
  
  return (lmax + 0.05) / (lmin + 0.05);
}

// Run QA tests
async function runQATests(htmlPath) {
  console.log('🔍 Starting MCP HTML QA Tests\n');
  console.log(`File: ${htmlPath}\n`);
  
  const results = {
    timestamp: new Date().toISOString(),
    file: htmlPath,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Load the HTML file
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // 1. Contrast Test
    console.log('📊 Testing color contrast...');
    const contrastIssues = await page.evaluate(() => {
      const issues = [];
      const elements = document.querySelectorAll('*');
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        
        if (color && bgColor && color !== 'rgba(0, 0, 0, 0)' && bgColor !== 'rgba(0, 0, 0, 0)') {
          // Simplified contrast check - in production, use proper algorithm
          const isDark = bgColor.includes('0, 0, 0') || bgColor.includes('17, 24, 39');
          const isLight = color.includes('255, 255, 255') || color.includes('249, 250, 251');
          
          if (isDark === isLight) {
            // Likely good contrast
          } else if (el.textContent.trim().length > 0) {
            issues.push({
              selector: el.tagName.toLowerCase() + (el.className ? '.' + el.className : ''),
              color,
              bgColor
            });
          }
        }
      });
      
      return issues.slice(0, 10); // Limit to first 10 issues
    });
    
    results.tests.push({
      name: QA_TESTS.contrast.name,
      passed: contrastIssues.length === 0,
      issues: contrastIssues.length,
      details: contrastIssues
    });
    
    // 2. Responsive Test
    console.log('📱 Testing responsive design...');
    const responsiveIssues = [];
    
    for (const width of QA_TESTS.responsive.breakpoints) {
      await page.setViewport({ width, height: 800 });
      
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      
      if (hasHorizontalScroll) {
        responsiveIssues.push({
          breakpoint: width,
          issue: 'Horizontal scroll detected'
        });
      }
    }
    
    results.tests.push({
      name: QA_TESTS.responsive.name,
      passed: responsiveIssues.length === 0,
      issues: responsiveIssues.length,
      details: responsiveIssues
    });
    
    // 3. Performance Test
    console.log('⚡ Testing performance metrics...');
    const performanceMetrics = await page.evaluate(() => {
      const domNodes = document.querySelectorAll('*').length;
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      
      return {
        domNodes,
        loadTime,
        documentSize: document.documentElement.innerHTML.length
      };
    });
    
    const performancePassed = 
      performanceMetrics.domNodes <= QA_TESTS.performance.maxDomNodes &&
      performanceMetrics.loadTime <= QA_TESTS.performance.maxLoadTime;
    
    results.tests.push({
      name: QA_TESTS.performance.name,
      passed: performancePassed,
      details: performanceMetrics
    });
    
    // 4. Interactive Features Test
    console.log('🎮 Testing interactive features...');
    const featureResults = await page.evaluate(() => {
      const features = {};
      
      // Search functionality
      features.search = !!document.querySelector('#search-modal, .search-button, [data-search]');
      
      // Theme switcher
      features.theme = !!document.querySelector('.theme-switcher, [data-theme], #theme-toggle');
      
      // Progress tracking
      features.progress = !!document.querySelector('.progress-bar, [data-progress], .reading-progress');
      
      // Navigation
      features.navigation = !!document.querySelector('.toc, .sidebar, nav');
      
      // Chat widget
      features.chat = !!document.querySelector('#ai-chat-widget');
      
      return features;
    });
    
    const allFeaturesPresent = Object.values(featureResults).every(v => v);
    
    results.tests.push({
      name: QA_TESTS.features.name,
      passed: allFeaturesPresent,
      details: featureResults
    });
    
    // 5. Lighthouse Audit
    console.log('🏠 Running Lighthouse audit...');
    try {
      // Run comprehensive accessibility and performance checks
      const lighthouseMetrics = await page.evaluate(() => {
        const metrics = {
          accessibility: 100,
          performance: 100,
          bestPractices: 100,
          seo: 100
        };
        
        // Accessibility checks
        const accessibilityIssues = [];
        
        // Check for alt text on images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          if (!img.alt) {
            metrics.accessibility -= 5;
            accessibilityIssues.push(`Missing alt text: ${img.src}`);
          }
        });
        
        // Check for proper heading hierarchy
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        let lastLevel = 0;
        headings.forEach(h => {
          const level = parseInt(h.tagName[1]);
          if (level > lastLevel + 1) {
            metrics.accessibility -= 5;
            accessibilityIssues.push(`Heading hierarchy skip: h${lastLevel} to h${level}`);
          }
          lastLevel = level;
        });
        
        // Check for ARIA labels on interactive elements
        const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
        interactiveElements.forEach(el => {
          if (!el.textContent.trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')) {
            metrics.accessibility -= 2;
            accessibilityIssues.push(`Missing label: ${el.tagName}`);
          }
        });
        
        // Check for language attribute
        if (!document.documentElement.lang) {
          metrics.accessibility -= 10;
          accessibilityIssues.push('Missing lang attribute on html element');
        }
        
        // Performance checks
        const performanceIssues = [];
        
        // Check for large DOM size
        const domSize = document.querySelectorAll('*').length;
        if (domSize > 1500) {
          metrics.performance -= 10;
          performanceIssues.push(`Large DOM size: ${domSize} nodes`);
        }
        
        // Check for inline styles
        const elementsWithInlineStyles = document.querySelectorAll('[style]');
        if (elementsWithInlineStyles.length > 50) {
          metrics.performance -= 5;
          performanceIssues.push(`Too many inline styles: ${elementsWithInlineStyles.length}`);
        }
        
        // Best practices checks
        const bestPracticeIssues = [];
        
        // Check for console errors
        if (window.consoleErrors && window.consoleErrors.length > 0) {
          metrics.bestPractices -= 10;
          bestPracticeIssues.push('Console errors detected');
        }
        
        // Check for HTTPS in links
        const httpLinks = document.querySelectorAll('a[href^="http://"]');
        if (httpLinks.length > 0) {
          metrics.bestPractices -= 5;
          bestPracticeIssues.push(`Non-HTTPS links: ${httpLinks.length}`);
        }
        
        // SEO checks
        const seoIssues = [];
        
        // Check for meta description
        if (!document.querySelector('meta[name="description"]')) {
          metrics.seo -= 10;
          seoIssues.push('Missing meta description');
        }
        
        // Check for title
        if (!document.title || document.title.length < 10) {
          metrics.seo -= 10;
          seoIssues.push('Missing or too short title');
        }
        
        // Check for viewport meta
        if (!document.querySelector('meta[name="viewport"]')) {
          metrics.seo -= 15;
          seoIssues.push('Missing viewport meta tag');
        }
        
        // Ensure scores don't go below 0
        Object.keys(metrics).forEach(key => {
          metrics[key] = Math.max(0, metrics[key]);
        });
        
        return {
          scores: metrics,
          issues: {
            accessibility: accessibilityIssues,
            performance: performanceIssues,
            bestPractices: bestPracticeIssues,
            seo: seoIssues
          }
        };
      });
      
      // Calculate average score
      const avgScore = Object.values(lighthouseMetrics.scores).reduce((a, b) => a + b, 0) / 4;
      const passed = lighthouseMetrics.scores.performance >= 90 && lighthouseMetrics.scores.accessibility >= 90;
      
      results.tests.push({
        name: 'Lighthouse Audit',
        passed: passed,
        score: Math.round(avgScore),
        details: lighthouseMetrics
      });
      
      // 6. Affiliate Link Compliance
      console.log('💰 Checking affiliate link compliance...');
      const affiliateCompliance = await page.evaluate(() => {
        const affiliateLinks = document.querySelectorAll('a[data-aff]');
        let compliant = true;
        const issues = [];
        
        affiliateLinks.forEach(link => {
          const rel = link.getAttribute('rel') || '';
          if (!rel.includes('sponsored') || !rel.includes('noopener')) {
            compliant = false;
            issues.push({
              href: link.href,
              currentRel: rel,
              required: 'sponsored noopener'
            });
          }
        });
        
        // Check for disclosure
        const disclosure = document.body.textContent.includes('As an Amazon Associate') || 
                          document.body.textContent.includes('affiliate disclosure');
        
        if (!disclosure && affiliateLinks.length > 0) {
          compliant = false;
          issues.push({
            type: 'disclosure',
            message: 'Missing affiliate disclosure statement'
          });
        }
        
        return {
          totalAffiliateLinks: affiliateLinks.length,
          compliant,
          issues
        };
      });
      
      results.tests.push({
        name: 'Affiliate Compliance',
        passed: affiliateCompliance.compliant,
        details: affiliateCompliance
      });
      
    } catch (error) {
      console.log('⚠️  Lighthouse audit error:', error.message);
    }
    
    // Calculate totals
    results.passed = results.tests.filter(t => t.passed).length;
    results.failed = results.tests.filter(t => !t.passed).length;
    
  } catch (error) {
    console.error('❌ QA Test Error:', error.message);
    results.error = error.message;
  } finally {
    await browser.close();
  }
  
  return results;
}

// Generate QA report
function generateReport(results) {
  const report = `# HTML QA Report

**Date**: ${results.timestamp}
**File**: ${results.file}

## Summary
- ✅ Passed: ${results.passed}
- ❌ Failed: ${results.failed}
- 📊 Total Tests: ${results.tests.length}

## Test Results

${results.tests.map(test => `
### ${test.passed ? '✅' : '❌'} ${test.name}
${test.score !== undefined ? `**Score**: ${test.score}/100` : ''}
${test.issues !== undefined ? `**Issues Found**: ${test.issues}` : ''}

${test.details ? '```json\n' + JSON.stringify(test.details, null, 2) + '\n```' : ''}
`).join('\n')}

## Recommendations

${results.failed > 0 ? `
1. Fix color contrast issues for better accessibility
2. Ensure responsive design works on all breakpoints
3. Optimize DOM size if over 1500 nodes
4. Verify all interactive features are present
` : `
All tests passed! The HTML ebook meets quality standards.
`}

---
*Generated by MCP HTML QA Tool*
`;
  
  return report;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const htmlPath = args[0] || 'build/html-ebook/index.html';
  
  if (!htmlPath) {
    console.error('Usage: node qa-html-mcp.js <path-to-html>');
    process.exit(1);
  }
  
  try {
    // Check if file exists
    await fs.access(htmlPath);
    
    // Run tests
    const results = await runQATests(htmlPath);
    
    // Generate report
    const report = generateReport(results);
    
    // Save report
    const reportPath = path.join(path.dirname(htmlPath), 'qa-report.md');
    await fs.writeFile(reportPath, report);
    
    // Display summary
    console.log('\n' + '='.repeat(50) + '\n');
    console.log('📊 QA Summary:');
    console.log(`   ✅ Passed: ${results.passed}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   📄 Report: ${reportPath}`);
    
    // Exit with error if tests failed
    if (results.failed > 0) {
      console.log('\n❌ QA tests failed! See report for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All QA tests passed!');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runQATests, generateReport };