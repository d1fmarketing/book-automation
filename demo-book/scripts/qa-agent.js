#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ContentValidator = require('./content-validator');

// Color codes for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// Quality criteria for commercial PDF
const QA_CRITERIA = {
    typography: {
        h1: {
            minSize: 28,
            maxSize: 36,
            minMarginTop: 0,
            maxMarginBottom: 25
        },
        h2: {
            minSize: 18,
            maxSize: 22,
            minMarginTop: 15,
            maxMarginBottom: 20
        },
        h3: {
            minSize: 14,
            maxSize: 18,
            minMarginTop: 15,
            maxMarginBottom: 12
        },
        body: {
            minSize: 12,
            maxSize: 16,
            lineHeightMin: 1.4,
            lineHeightMax: 1.6
        },
        firstLetter: {
            minSize: 35,
            maxSize: 45
        }
    },
    spacing: {
        maxEmptySpace: 100, // pixels
        minParagraphGap: 10,
        maxParagraphGap: 30
    },
    layout: {
        minMargin: 20,
        maxMargin: 100,
        minTextWidth: 400,
        maxTextWidth: 600
    },
    colors: {
        minContrast: 4.5, // WCAG AA standard
        allowedTextColors: ['#1a1a1a', '#333333', '#ffffff'],
        allowedBackgrounds: ['#ffffff', '#f8f9fa', '#7FCDBB', '#FFE5B4', '#E8F4FD', '#FFF4E6']
    }
};

class PDFQualityAgent {
    constructor(pdfPath) {
        this.pdfPath = pdfPath;
        this.browser = null;
        this.issues = [];
        this.warnings = [];
        this.pageReports = [];
        this.passedChecks = 0;
        this.totalChecks = 0;
    }

    async initialize() {
        console.log(`${colors.cyan}${colors.bold}🤖 PDF Quality Agent v1.0${colors.reset}`);
        console.log(`${colors.blue}Initializing browser for inspection...${colors.reset}\n`);
        
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    async inspectPDF() {
        const page = await this.browser.newPage();
        
        // Set viewport for consistent rendering
        await page.setViewport({
            width: 612,  // 8.5 inches at 72 DPI
            height: 792, // 11 inches at 72 DPI
            deviceScaleFactor: 2
        });

        // Navigate to PDF
        const pdfUrl = `file://${this.pdfPath}`;
        console.log(`${colors.blue}Loading PDF: ${path.basename(this.pdfPath)}${colors.reset}`);
        
        try {
            await page.goto(pdfUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        } catch (error) {
            // If direct PDF loading fails, try to convert to HTML first
            console.log(`${colors.yellow}Direct PDF loading not supported, analyzing HTML version...${colors.reset}`);
            return await this.inspectHTMLVersion(page);
        }

        // PDF direct inspection not supported in Puppeteer
        // Try HTML version instead
        console.log(`${colors.yellow}Switching to HTML version for inspection...${colors.reset}`);
        return await this.inspectHTMLVersion(page);
    }

    async inspectHTMLVersion(page) {
        // Look for HTML version - check multiple possible paths
        let htmlPath = this.pdfPath.replace('.pdf', '.html');
        
        // If not in same directory, check temp directory
        if (!fs.existsSync(htmlPath)) {
            const tempPath = path.join(
                path.dirname(path.dirname(this.pdfPath)), 
                'temp', 
                path.basename(this.pdfPath).replace('.pdf', '.html')
            );
            if (fs.existsSync(tempPath)) {
                htmlPath = tempPath;
            }
        }
        
        // Try with 'commercial' in the name first (preferred)
        if (!fs.existsSync(htmlPath)) {
            const commercialPath = path.join(
                path.dirname(path.dirname(this.pdfPath)), 
                'temp', 
                'adhd-book-commercial.html'
            );
            if (fs.existsSync(commercialPath)) {
                htmlPath = commercialPath;
                console.log(`${colors.green}Using commercial HTML for analysis${colors.reset}`);
            }
        }
        
        // Try with 'perfect' in the name as fallback
        if (!fs.existsSync(htmlPath)) {
            const perfectPath = path.join(
                path.dirname(path.dirname(this.pdfPath)), 
                'temp', 
                'adhd-book-perfect.html'
            );
            if (fs.existsSync(perfectPath)) {
                htmlPath = perfectPath;
                console.log(`${colors.yellow}Using perfect HTML for analysis (fallback)${colors.reset}`);
            }
        }
        
        if (!fs.existsSync(htmlPath)) {
            this.issues.push({
                severity: 'critical',
                type: 'file',
                message: 'Cannot inspect PDF - HTML version not found',
                suggestion: 'Generate HTML with DEBUG=1 npm run build:pdf'
            });
            return;
        }

        // CRITICAL: Run content validation FIRST
        console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.cyan}${colors.bold}STEP 1: CONTENT VALIDATION${colors.reset}`);
        console.log(`${'='.repeat(60)}\n`);
        
        const contentValidator = new ContentValidator();
        const contentPassed = await contentValidator.validatePDFContent(htmlPath);
        
        if (!contentPassed) {
            // Content validation failed - this is CRITICAL
            console.log(`\n${colors.red}${colors.bold}⛔ STOPPING: Content validation failed!${colors.reset}`);
            console.log(`${colors.red}Fix all content issues before checking typography.${colors.reset}\n`);
            
            // Add all critical errors to our issues
            contentValidator.criticalErrors.forEach(error => {
                this.issues.push({
                    severity: 'critical',
                    type: 'content',
                    message: error.message,
                    details: error
                });
            });
            
            // Skip typography checks if content is wrong
            this.qualityGateFailed = true;
            return;
        }
        
        console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.cyan}${colors.bold}STEP 2: TYPOGRAPHY & LAYOUT VALIDATION${colors.reset}`);
        console.log(`${'='.repeat(60)}\n`);

        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
        
        // Count chapters and page breaks for accurate page detection
        const pageInfo = await page.evaluate(() => {
            const chapters = document.querySelectorAll('.chapter');
            const pageBreaks = document.querySelectorAll('.page-break');
            const h1Elements = document.querySelectorAll('h1');
            
            return {
                chapterCount: chapters.length,
                pageBreakCount: pageBreaks.length,
                h1Count: h1Elements.length,
                documentHeight: document.body.scrollHeight
            };
        });
        
        // Use the maximum of chapters or page breaks + 1
        const totalPages = Math.max(pageInfo.chapterCount, pageInfo.pageBreakCount + 1);
        
        console.log(`${colors.green}Document Analysis:${colors.reset}`);
        console.log(`  Chapters found: ${pageInfo.chapterCount}`);
        console.log(`  Page breaks: ${pageInfo.pageBreakCount}`);
        console.log(`  H1 elements: ${pageInfo.h1Count}`);
        console.log(`  Total pages to analyze: ${totalPages}\n`);

        // Analyze each logical page/chapter
        const pageHeight = 792; // Standard page height
        const totalScrollablePages = Math.ceil(pageInfo.documentHeight / pageHeight);
        
        for (let i = 1; i <= totalPages; i++) {
            await this.inspectHTMLPage(page, i, totalPages);
        }
    }

    async inspectHTMLPage(page, pageNum, totalPages) {
        console.log(`${colors.bold}📄 Page ${pageNum}/${totalPages}${colors.reset}`);
        console.log('─'.repeat(50));

        const pageReport = {
            page: pageNum,
            checks: [],
            issues: [],
            warnings: []
        };

        // Find and scroll to the specific chapter/page
        const chapterPosition = await page.evaluate((pageIndex) => {
            const chapters = document.querySelectorAll('.chapter');
            if (chapters[pageIndex - 1]) {
                const rect = chapters[pageIndex - 1].getBoundingClientRect();
                const scrollY = window.pageYOffset + rect.top;
                window.scrollTo(0, scrollY);
                return scrollY;
            } else {
                // Fallback to approximate position
                const scrollY = (pageIndex - 1) * 792;
                window.scrollTo(0, scrollY);
                return scrollY;
            }
        }, pageNum);
        
        await new Promise(resolve => setTimeout(resolve, 200)); // Allow render

        // Run all quality checks
        await this.checkTypography(page, pageReport);
        await this.checkSpacing(page, pageReport);
        await this.checkLayout(page, pageReport);
        await this.checkColors(page, pageReport);
        await this.checkImages(page, pageReport);
        await this.checkConsistency(page, pageReport, pageNum);
        await this.checkAccessibility(page, pageReport);

        // Save screenshot for review
        const screenshotPath = path.join(
            path.dirname(this.pdfPath),
            'qa-screenshots',
            `page-${pageNum}.png`
        );
        await this.ensureDirectory(path.dirname(screenshotPath));
        
        // Get current scroll position for screenshot
        const currentScrollY = await page.evaluate(() => window.pageYOffset);
        const viewportHeight = await page.evaluate(() => window.innerHeight);
        
        await page.screenshot({
            path: screenshotPath,
            clip: {
                x: 0,
                y: 0,
                width: 612,
                height: Math.min(viewportHeight, 792)
            }
        });

        // Add to reports
        this.pageReports.push(pageReport);
        this.issues.push(...pageReport.issues);
        this.warnings.push(...pageReport.warnings);

        // Show page summary
        const pageIssues = pageReport.issues.length;
        const pageWarnings = pageReport.warnings.length;
        const pagePassed = pageReport.checks.filter(c => c.passed).length;
        const pageTotal = pageReport.checks.length;

        if (pageIssues === 0 && pageWarnings === 0) {
            console.log(`${colors.green}✅ Page ${pageNum}: PASSED (${pagePassed}/${pageTotal} checks)${colors.reset}`);
        } else if (pageIssues > 0) {
            console.log(`${colors.red}❌ Page ${pageNum}: FAILED (${pageIssues} issues, ${pageWarnings} warnings)${colors.reset}`);
        } else {
            console.log(`${colors.yellow}⚠️  Page ${pageNum}: PASSED with warnings (${pageWarnings} warnings)${colors.reset}`);
        }

        // Show critical issues immediately
        pageReport.issues.forEach(issue => {
            if (issue.severity === 'critical') {
                console.log(`   ${colors.red}└─ ${issue.message}${colors.reset}`);
            }
        });

        console.log('');
    }

    async checkTypography(page, report) {
        const typography = await page.evaluate(() => {
            const results = {
                h1: [],
                h2: [],
                h3: [],
                body: [],
                firstLetters: []
            };

            // Check headings (excluding cover page elements)
            ['h1', 'h2', 'h3'].forEach(tag => {
                const elements = document.querySelectorAll(tag);
                elements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.height > 0) { // Visible element
                        // Skip cover page elements for typography checks
                        const isOnCover = el.closest('.cover') !== null;
                        
                        const computed = window.getComputedStyle(el);
                        results[tag].push({
                            text: el.textContent.substring(0, 50),
                            fontSize: parseFloat(computed.fontSize),
                            marginTop: parseFloat(computed.marginTop),
                            marginBottom: parseFloat(computed.marginBottom),
                            lineHeight: computed.lineHeight,
                            color: computed.color,
                            isOnCover: isOnCover
                        });
                    }
                });
            });

            // Check body text
            const paragraphs = document.querySelectorAll('p');
            paragraphs.forEach(p => {
                const rect = p.getBoundingClientRect();
                if (rect.height > 0) {
                    const computed = window.getComputedStyle(p);
                    results.body.push({
                        fontSize: parseFloat(computed.fontSize),
                        lineHeight: computed.lineHeight,
                        marginBottom: parseFloat(computed.marginBottom)
                    });
                }
            });

            // Check first letters
            const firstLetters = document.querySelectorAll('.first-letter, p:first-of-type::first-letter');
            firstLetters.forEach(el => {
                const computed = window.getComputedStyle(el, '::first-letter');
                if (computed.fontSize !== window.getComputedStyle(el).fontSize) {
                    results.firstLetters.push({
                        fontSize: parseFloat(computed.fontSize)
                    });
                }
            });

            return results;
        });

        // Validate typography
        this.validateTypography(typography, report);
    }

    validateTypography(typography, report) {
        const criteria = QA_CRITERIA.typography;

        // Check H1
        typography.h1.forEach(h1 => {
            // Skip cover page H1s which can be larger for impact
            if (h1.isOnCover) {
                return;
            }
            
            const check = {
                type: 'typography',
                element: 'h1',
                passed: true
            };

            if (h1.fontSize < criteria.h1.minSize || h1.fontSize > criteria.h1.maxSize) {
                check.passed = false;
                report.issues.push({
                    severity: 'high',
                    type: 'typography',
                    element: 'h1',
                    message: `H1 font size ${h1.fontSize}px outside range [${criteria.h1.minSize}-${criteria.h1.maxSize}px]`,
                    value: h1.fontSize,
                    expected: `${criteria.h1.minSize}-${criteria.h1.maxSize}px`
                });
            }

            if (h1.marginBottom > criteria.h1.maxMarginBottom) {
                check.passed = false;
                report.warnings.push({
                    type: 'spacing',
                    element: 'h1',
                    message: `H1 bottom margin ${h1.marginBottom}px exceeds ${criteria.h1.maxMarginBottom}px`
                });
            }

            report.checks.push(check);
            this.totalChecks++;
            if (check.passed) this.passedChecks++;
        });

        // Check H2
        typography.h2.forEach(h2 => {
            const check = {
                type: 'typography',
                element: 'h2',
                passed: true
            };

            if (h2.fontSize < criteria.h2.minSize || h2.fontSize > criteria.h2.maxSize) {
                check.passed = false;
                report.issues.push({
                    severity: 'high',
                    type: 'typography',
                    element: 'h2',
                    message: `H2 font size ${h2.fontSize}px outside range [${criteria.h2.minSize}-${criteria.h2.maxSize}px]`,
                    text: h2.text
                });
            }

            report.checks.push(check);
            this.totalChecks++;
            if (check.passed) this.passedChecks++;
        });

        // Check body text
        if (typography.body.length > 0) {
            const avgBodySize = typography.body.reduce((sum, p) => sum + p.fontSize, 0) / typography.body.length;
            const check = {
                type: 'typography',
                element: 'body',
                passed: true
            };

            if (avgBodySize < criteria.body.minSize || avgBodySize > criteria.body.maxSize) {
                check.passed = false;
                report.issues.push({
                    severity: 'medium',
                    type: 'typography',
                    element: 'body',
                    message: `Body text average size ${avgBodySize.toFixed(1)}px outside range [${criteria.body.minSize}-${criteria.body.maxSize}px]`
                });
            }

            report.checks.push(check);
            this.totalChecks++;
            if (check.passed) this.passedChecks++;
        }

        // Check visual hierarchy
        const nonCoverH1s = typography.h1.filter(h => !h.isOnCover);
        const nonCoverH2s = typography.h2.filter(h => !h.isOnCover);
        
        if (nonCoverH1s.length > 0 && nonCoverH2s.length > 0) {
            const h1Size = nonCoverH1s[0].fontSize;
            const h2Size = nonCoverH2s[0].fontSize;
            const check = {
                type: 'hierarchy',
                passed: true
            };

            if (h1Size <= h2Size * 1.3) {
                check.passed = false;
                report.issues.push({
                    severity: 'high',
                    type: 'hierarchy',
                    message: `Poor visual hierarchy: H1 (${h1Size}px) should be at least 30% larger than H2 (${h2Size}px)`
                });
            }

            report.checks.push(check);
            this.totalChecks++;
            if (check.passed) this.passedChecks++;
        }
    }

    async checkSpacing(page, report) {
        const spacing = await page.evaluate(() => {
            const results = {
                emptySpaces: [],
                paragraphGaps: []
            };

            // Check for large empty spaces
            const elements = document.querySelectorAll('*');
            let lastBottom = 0;

            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.height > 0 && rect.top > lastBottom) {
                    const gap = rect.top - lastBottom;
                    if (gap > 100) { // Large gap
                        results.emptySpaces.push({
                            gap: gap,
                            after: el.previousElementSibling?.tagName || 'start',
                            before: el.tagName
                        });
                    }
                    lastBottom = rect.bottom;
                }
            });

            // Check paragraph spacing
            const paragraphs = document.querySelectorAll('p');
            for (let i = 1; i < paragraphs.length; i++) {
                const prev = paragraphs[i - 1].getBoundingClientRect();
                const curr = paragraphs[i].getBoundingClientRect();
                const gap = curr.top - prev.bottom;
                
                if (gap > 0) {
                    results.paragraphGaps.push(gap);
                }
            }

            return results;
        });

        // Validate spacing
        const criteria = QA_CRITERIA.spacing;

        spacing.emptySpaces.forEach(space => {
            if (space.gap > criteria.maxEmptySpace) {
                report.issues.push({
                    severity: 'medium',
                    type: 'spacing',
                    message: `Large empty space of ${Math.round(space.gap)}px between ${space.after} and ${space.before}`,
                    suggestion: 'Reduce vertical spacing or add content'
                });
            }
        });

        const check = {
            type: 'spacing',
            passed: spacing.emptySpaces.filter(s => s.gap > criteria.maxEmptySpace).length === 0
        };
        report.checks.push(check);
        this.totalChecks++;
        if (check.passed) this.passedChecks++;
    }

    async checkLayout(page, report) {
        const layout = await page.evaluate(() => {
            const body = document.body;
            const computed = window.getComputedStyle(body);
            
            // Find main content area
            const mainContent = document.querySelector('.content, main, article') || body;
            const contentRect = mainContent.getBoundingClientRect();
            const contentStyle = window.getComputedStyle(mainContent);

            return {
                pageWidth: body.scrollWidth,
                contentWidth: contentRect.width,
                leftMargin: parseFloat(contentStyle.marginLeft) || parseFloat(contentStyle.paddingLeft) || 0,
                rightMargin: parseFloat(contentStyle.marginRight) || parseFloat(contentStyle.paddingRight) || 0,
                hasOverflow: body.scrollWidth > window.innerWidth
            };
        });

        const criteria = QA_CRITERIA.layout;

        // Check margins
        if (layout.leftMargin < criteria.minMargin || layout.rightMargin < criteria.minMargin) {
            report.issues.push({
                severity: 'medium',
                type: 'layout',
                message: `Margins too small: left=${layout.leftMargin}px, right=${layout.rightMargin}px (min: ${criteria.minMargin}px)`
            });
        }

        // Check content width
        if (layout.contentWidth < criteria.minTextWidth || layout.contentWidth > criteria.maxTextWidth) {
            report.warnings.push({
                type: 'layout',
                message: `Content width ${layout.contentWidth}px outside optimal range [${criteria.minTextWidth}-${criteria.maxTextWidth}px]`
            });
        }

        // Check overflow
        if (layout.hasOverflow) {
            report.issues.push({
                severity: 'critical',
                type: 'layout',
                message: 'Page has horizontal overflow - content extends beyond page boundaries'
            });
        }

        const check = {
            type: 'layout',
            passed: !layout.hasOverflow && layout.leftMargin >= criteria.minMargin
        };
        report.checks.push(check);
        this.totalChecks++;
        if (check.passed) this.passedChecks++;
    }

    async checkColors(page, report) {
        const colors = await page.evaluate(() => {
            const results = {
                textColors: new Set(),
                backgroundColors: new Set(),
                contrasts: []
            };

            // Get all text elements
            const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, span, div');
            
            textElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.height > 0) {
                    const computed = window.getComputedStyle(el);
                    const color = computed.color;
                    const bgColor = computed.backgroundColor;
                    
                    if (color && color !== 'rgba(0, 0, 0, 0)') {
                        results.textColors.add(color);
                    }
                    
                    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
                        results.backgroundColors.add(bgColor);
                    }

                    // Calculate contrast if both colors are defined
                    if (color && bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
                        // Simple contrast check (would need proper WCAG calculation)
                        results.contrasts.push({
                            element: el.tagName,
                            color: color,
                            background: bgColor
                        });
                    }
                }
            });

            return {
                textColors: Array.from(results.textColors),
                backgroundColors: Array.from(results.backgroundColors),
                contrasts: results.contrasts.slice(0, 10) // Sample
            };
        });

        // Check color consistency
        if (colors.textColors.length > 5) {
            report.warnings.push({
                type: 'colors',
                message: `Too many text colors (${colors.textColors.length}) - consider reducing for consistency`
            });
        }

        const check = {
            type: 'colors',
            passed: colors.textColors.length <= 5
        };
        report.checks.push(check);
        this.totalChecks++;
        if (check.passed) this.passedChecks++;
    }

    async checkImages(page, report) {
        const images = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            return Array.from(imgs).map(img => ({
                src: img.src,
                alt: img.alt,
                width: img.naturalWidth,
                height: img.naturalHeight,
                displayed: img.getBoundingClientRect().height > 0
            }));
        });

        images.forEach(img => {
            if (img.displayed && !img.alt) {
                report.warnings.push({
                    type: 'accessibility',
                    message: `Image missing alt text: ${path.basename(img.src)}`
                });
            }

            if (img.width > 1600) {
                report.warnings.push({
                    type: 'performance',
                    message: `Image too large: ${path.basename(img.src)} (${img.width}x${img.height})`
                });
            }
        });

        const check = {
            type: 'images',
            passed: images.every(img => !img.displayed || img.alt)
        };
        report.checks.push(check);
        this.totalChecks++;
        if (check.passed) this.passedChecks++;
    }

    async checkConsistency(page, report, pageNum) {
        // Store page signature for consistency checking
        const signature = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const h2 = document.querySelector('h2');
            const firstP = document.querySelector('p');
            
            return {
                hasH1: !!h1,
                h1Size: h1 ? parseFloat(window.getComputedStyle(h1).fontSize) : null,
                hasH2: !!h2,
                h2Size: h2 ? parseFloat(window.getComputedStyle(h2).fontSize) : null,
                bodySize: firstP ? parseFloat(window.getComputedStyle(firstP).fontSize) : null
            };
        });

        // Store for cross-page consistency checks
        if (!this.pageSignatures) {
            this.pageSignatures = [];
        }
        this.pageSignatures.push({ page: pageNum, ...signature });

        // Check consistency with previous pages
        if (this.pageSignatures.length > 1) {
            const prevSigs = this.pageSignatures.slice(0, -1);
            const currentSig = signature;

            // Check if font sizes are consistent
            const h1Sizes = prevSigs.filter(s => s.h1Size).map(s => s.h1Size);
            if (currentSig.h1Size && h1Sizes.length > 0) {
                const avgH1 = h1Sizes.reduce((a, b) => a + b, 0) / h1Sizes.length;
                if (Math.abs(currentSig.h1Size - avgH1) > 2) {
                    report.warnings.push({
                        type: 'consistency',
                        message: `H1 size inconsistent with previous pages (${currentSig.h1Size}px vs avg ${avgH1.toFixed(1)}px)`
                    });
                }
            }
        }
    }

    async checkAccessibility(page, report) {
        console.log(`   ${colors.blue}♿ Checking accessibility...${colors.reset}`);
        
        const accessibilityData = await page.evaluate(() => {
            const results = {
                hasLang: document.documentElement.hasAttribute('lang'),
                lang: document.documentElement.getAttribute('lang'),
                imagesWithoutAlt: [],
                headingHierarchy: [],
                ariaRoles: [],
                formLabels: [],
                colorContrast: [],
                semanticStructure: {
                    hasMain: !!document.querySelector('main'),
                    hasNav: !!document.querySelector('nav'),
                    hasHeader: !!document.querySelector('header'),
                    hasFooter: !!document.querySelector('footer'),
                    hasArticle: !!document.querySelector('article')
                }
            };
            
            // Check images for alt text
            document.querySelectorAll('img').forEach(img => {
                if (!img.hasAttribute('alt') || img.alt.trim() === '') {
                    results.imagesWithoutAlt.push({
                        src: img.src.split('/').pop(),
                        width: img.width,
                        visible: img.getBoundingClientRect().height > 0
                    });
                }
            });
            
            // Check heading hierarchy
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let lastLevel = 0;
            headings.forEach(h => {
                const level = parseInt(h.tagName.substring(1));
                results.headingHierarchy.push({
                    level: level,
                    text: h.textContent.substring(0, 50),
                    skipped: level > lastLevel + 1
                });
                lastLevel = level;
            });
            
            // Check ARIA roles
            document.querySelectorAll('[role]').forEach(el => {
                results.ariaRoles.push({
                    role: el.getAttribute('role'),
                    tag: el.tagName,
                    hasLabel: el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
                });
            });
            
            // Check form labels
            document.querySelectorAll('input, select, textarea').forEach(input => {
                const hasLabel = !!document.querySelector(`label[for="${input.id}"]`) || 
                               input.hasAttribute('aria-label') ||
                               input.hasAttribute('aria-labelledby');
                if (!hasLabel && input.type !== 'hidden') {
                    results.formLabels.push({
                        type: input.type || input.tagName,
                        id: input.id || 'no-id'
                    });
                }
            });
            
            return results;
        });
        
        // Validate accessibility
        const check = {
            type: 'accessibility',
            passed: true
        };
        
        // Check lang attribute
        if (!accessibilityData.hasLang) {
            check.passed = false;
            report.issues.push({
                severity: 'high',
                type: 'accessibility',
                message: 'Missing lang attribute on HTML element',
                suggestion: 'Add lang="pt-BR" to the html tag'
            });
        }
        
        // Check images
        const visibleImagesWithoutAlt = accessibilityData.imagesWithoutAlt.filter(img => img.visible);
        if (visibleImagesWithoutAlt.length > 0) {
            check.passed = false;
            report.issues.push({
                severity: 'high',
                type: 'accessibility',
                message: `${visibleImagesWithoutAlt.length} visible images missing alt text`,
                details: visibleImagesWithoutAlt.map(img => img.src).join(', ')
            });
        }
        
        // Check heading hierarchy
        const skippedHeadings = accessibilityData.headingHierarchy.filter(h => h.skipped);
        if (skippedHeadings.length > 0) {
            report.warnings.push({
                type: 'accessibility',
                message: `Skipped heading levels detected (jumped from h${skippedHeadings[0].level - 2} to h${skippedHeadings[0].level})`
            });
        }
        
        // Check semantic structure
        if (!accessibilityData.semanticStructure.hasMain) {
            report.warnings.push({
                type: 'accessibility',
                message: 'Missing <main> element for primary content'
            });
        }
        
        // Check form accessibility
        if (accessibilityData.formLabels.length > 0) {
            check.passed = false;
            report.issues.push({
                severity: 'high',
                type: 'accessibility',
                message: `${accessibilityData.formLabels.length} form elements missing labels`
            });
        }
        
        // Log summary
        console.log(`      - Language: ${accessibilityData.lang || 'not set'}`);
        console.log(`      - Images with alt text: ${accessibilityData.imagesWithoutAlt.length === 0 ? '✓' : '✗'}`);
        console.log(`      - ARIA roles found: ${accessibilityData.ariaRoles.length}`);
        console.log(`      - Semantic HTML: ${accessibilityData.semanticStructure.hasMain ? '✓' : '✗'}`);
        
        report.checks.push(check);
        this.totalChecks++;
        if (check.passed) this.passedChecks++;
    }

    async generateReport() {
        console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.cyan}${colors.bold}📊 QUALITY ASSURANCE REPORT${colors.reset}`);
        console.log(`${'='.repeat(60)}\n`);

        // Overall summary
        const totalIssues = this.issues.length;
        const criticalIssues = this.issues.filter(i => i.severity === 'critical').length;
        const highIssues = this.issues.filter(i => i.severity === 'high').length;
        const mediumIssues = this.issues.filter(i => i.severity === 'medium').length;
        const totalWarnings = this.warnings.length;

        console.log(`${colors.bold}📈 Overall Results:${colors.reset}`);
        console.log(`   Total Checks: ${this.totalChecks}`);
        console.log(`   Passed: ${colors.green}${this.passedChecks}${colors.reset}`);
        console.log(`   Failed: ${colors.red}${this.totalChecks - this.passedChecks}${colors.reset}`);
        console.log(`   Success Rate: ${((this.passedChecks / this.totalChecks) * 100).toFixed(1)}%\n`);

        console.log(`${colors.bold}🚨 Issues Summary:${colors.reset}`);
        console.log(`   Critical: ${colors.red}${criticalIssues}${colors.reset}`);
        console.log(`   High: ${colors.yellow}${highIssues}${colors.reset}`);
        console.log(`   Medium: ${colors.blue}${mediumIssues}${colors.reset}`);
        console.log(`   Warnings: ${colors.magenta}${totalWarnings}${colors.reset}\n`);

        // Quality gate - now includes content validation
        const passed = criticalIssues === 0 && highIssues <= 2 && !this.qualityGateFailed;
        
        if (passed) {
            console.log(`${colors.green}${colors.bold}✅ QUALITY GATE: PASSED${colors.reset}`);
            console.log(`${colors.green}   PDF is ready for shipment${colors.reset}\n`);
        } else {
            console.log(`${colors.red}${colors.bold}❌ QUALITY GATE: FAILED${colors.reset}`);
            console.log(`${colors.red}   PDF requires fixes before shipment${colors.reset}\n`);
        }

        // Critical issues detail
        if (criticalIssues > 0) {
            console.log(`${colors.red}${colors.bold}🔴 Critical Issues (MUST FIX):${colors.reset}`);
            this.issues.filter(i => i.severity === 'critical').forEach((issue, idx) => {
                console.log(`   ${idx + 1}. ${issue.message}`);
                if (issue.suggestion) {
                    console.log(`      ${colors.cyan}→ ${issue.suggestion}${colors.reset}`);
                }
            });
            console.log('');
        }

        // High priority issues
        if (highIssues > 0) {
            console.log(`${colors.yellow}${colors.bold}🟡 High Priority Issues:${colors.reset}`);
            this.issues.filter(i => i.severity === 'high').slice(0, 5).forEach((issue, idx) => {
                console.log(`   ${idx + 1}. ${issue.message}`);
            });
            if (highIssues > 5) {
                console.log(`   ... and ${highIssues - 5} more`);
            }
            console.log('');
        }

        // Generate detailed report file
        await this.saveDetailedReport();

        return passed;
    }

    async saveDetailedReport() {
        const reportPath = path.join(
            path.dirname(this.pdfPath),
            'qa-report.json'
        );

        const report = {
            timestamp: new Date().toISOString(),
            pdf: path.basename(this.pdfPath),
            summary: {
                totalPages: this.pageReports.length,
                totalChecks: this.totalChecks,
                passedChecks: this.passedChecks,
                failedChecks: this.totalChecks - this.passedChecks,
                successRate: ((this.passedChecks / this.totalChecks) * 100).toFixed(1) + '%',
                issues: {
                    critical: this.issues.filter(i => i.severity === 'critical').length,
                    high: this.issues.filter(i => i.severity === 'high').length,
                    medium: this.issues.filter(i => i.severity === 'medium').length,
                    total: this.issues.length
                },
                warnings: this.warnings.length
            },
            qualityGate: {
                passed: this.issues.filter(i => i.severity === 'critical').length === 0 &&
                        this.issues.filter(i => i.severity === 'high').length <= 2,
                reason: this.issues.filter(i => i.severity === 'critical').length > 0 
                    ? 'Critical issues found'
                    : this.issues.filter(i => i.severity === 'high').length > 2
                    ? 'Too many high priority issues'
                    : 'All checks passed'
            },
            issues: this.issues,
            warnings: this.warnings,
            pageReports: this.pageReports,
            recommendations: this.generateRecommendations()
        };

        await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`${colors.blue}📄 Detailed report saved to: ${colors.cyan}${path.basename(reportPath)}${colors.reset}`);

        // Generate HTML report
        await this.generateHTMLReport(report);
    }

    generateRecommendations() {
        const recommendations = [];

        // Typography recommendations
        const typographyIssues = this.issues.filter(i => i.type === 'typography');
        if (typographyIssues.length > 0) {
            recommendations.push({
                category: 'Typography',
                priority: 'high',
                suggestion: 'Review and standardize font sizes across all headings. Ensure clear visual hierarchy.',
                actions: [
                    'Set H1 to 54-56px for clear prominence',
                    'Set H2 to 28-30px for section headers',
                    'Maintain body text at 16px for readability'
                ]
            });
        }

        // Spacing recommendations
        const spacingIssues = this.issues.filter(i => i.type === 'spacing');
        if (spacingIssues.length > 0) {
            recommendations.push({
                category: 'Spacing',
                priority: 'medium',
                suggestion: 'Reduce excessive vertical spacing to improve content flow.',
                actions: [
                    'Limit heading bottom margins to 20-25px',
                    'Use consistent paragraph spacing (15-20px)',
                    'Remove unnecessary empty divs or breaks'
                ]
            });
        }

        // Consistency recommendations
        const consistencyWarnings = this.warnings.filter(w => w.type === 'consistency');
        if (consistencyWarnings.length > 0) {
            recommendations.push({
                category: 'Consistency',
                priority: 'medium',
                suggestion: 'Ensure styling is consistent across all pages.',
                actions: [
                    'Use CSS classes instead of inline styles',
                    'Create a style guide for all elements',
                    'Test each chapter with the same styles'
                ]
            });
        }

        return recommendations;
    }

    async generateHTMLReport(jsonReport) {
        const htmlPath = path.join(
            path.dirname(this.pdfPath),
            'qa-report.html'
        );

        const html = `<!DOCTYPE html>
<html>
<head>
    <title>PDF Quality Report - ${path.basename(this.pdfPath)}</title>
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
            margin: 0 0 10px 0;
            color: #2c3e50;
        }
        .timestamp {
            color: #7f8c8d;
            font-size: 14px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .metric-value {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-label {
            color: #7f8c8d;
            font-size: 14px;
        }
        .pass { color: #27ae60; }
        .fail { color: #e74c3c; }
        .warning { color: #f39c12; }
        .quality-gate {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin: 30px 0;
            text-align: center;
        }
        .gate-passed {
            background: #d4edda;
            color: #155724;
            border: 2px solid #c3e6cb;
        }
        .gate-failed {
            background: #f8d7da;
            color: #721c24;
            border: 2px solid #f5c6cb;
        }
        .issues-section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin: 30px 0;
        }
        .issue-item {
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid;
            background: #f8f9fa;
        }
        .issue-critical {
            border-color: #e74c3c;
            background: #fee;
        }
        .issue-high {
            border-color: #f39c12;
            background: #fff3cd;
        }
        .issue-medium {
            border-color: #3498db;
            background: #e3f2fd;
        }
        .recommendations {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin: 30px 0;
        }
        .recommendation-item {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        .recommendation-actions {
            margin-top: 10px;
            padding-left: 20px;
        }
        .page-previews {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .page-preview {
            background: white;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            text-align: center;
        }
        .page-preview img {
            width: 100%;
            border: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 PDF Quality Assurance Report</h1>
        <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
        <div class="timestamp">File: ${path.basename(this.pdfPath)}</div>
    </div>

    <div class="quality-gate ${jsonReport.qualityGate.passed ? 'gate-passed' : 'gate-failed'}">
        <h2>${jsonReport.qualityGate.passed ? '✅ QUALITY GATE: PASSED' : '❌ QUALITY GATE: FAILED'}</h2>
        <p>${jsonReport.qualityGate.reason}</p>
        ${jsonReport.qualityGate.passed 
            ? '<p><strong>This PDF is ready for commercial distribution.</strong></p>'
            : '<p><strong>This PDF requires fixes before shipment.</strong></p>'
        }
    </div>

    <div class="summary-grid">
        <div class="metric-card">
            <div class="metric-label">Total Pages</div>
            <div class="metric-value">${jsonReport.summary.totalPages}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Success Rate</div>
            <div class="metric-value ${parseFloat(jsonReport.summary.successRate) >= 90 ? 'pass' : 'warning'}">${jsonReport.summary.successRate}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Critical Issues</div>
            <div class="metric-value ${jsonReport.summary.issues.critical > 0 ? 'fail' : 'pass'}">${jsonReport.summary.issues.critical}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Total Issues</div>
            <div class="metric-value ${jsonReport.summary.issues.total > 10 ? 'warning' : ''}">${jsonReport.summary.issues.total}</div>
        </div>
    </div>

    ${jsonReport.issues.filter(i => i.severity === 'critical').length > 0 ? `
        <div class="issues-section">
            <h2>🔴 Critical Issues</h2>
            ${jsonReport.issues
                .filter(i => i.severity === 'critical')
                .map(issue => `
                    <div class="issue-item issue-critical">
                        <strong>${issue.message}</strong>
                        ${issue.suggestion ? `<br><em>Suggestion: ${issue.suggestion}</em>` : ''}
                    </div>
                `).join('')}
        </div>
    ` : ''}

    ${jsonReport.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            ${jsonReport.recommendations.map(rec => `
                <div class="recommendation-item">
                    <h3>${rec.category}</h3>
                    <p>${rec.suggestion}</p>
                    <div class="recommendation-actions">
                        <strong>Actions:</strong>
                        <ul>
                            ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : ''}

    <div class="page-previews">
        <h2>📄 Page Screenshots</h2>
        <p>Review the screenshots in the qa-screenshots folder for visual inspection.</p>
    </div>
</body>
</html>`;

        await fs.promises.writeFile(htmlPath, html);
        console.log(`${colors.blue}🌐 HTML report saved to: ${colors.cyan}${path.basename(htmlPath)}${colors.reset}`);
    }

    async ensureDirectory(dir) {
        try {
            await fs.promises.mkdir(dir, { recursive: true });
        } catch (error) {
            // Directory exists
        }
    }

    async getTotalPages(page) {
        // For HTML version, count page breaks and chapters
        return await page.evaluate(() => {
            const pageBreaks = document.querySelectorAll('.page-break');
            const chapters = document.querySelectorAll('.chapter');
            // Use the larger count (chapters or page breaks + 1)
            return Math.max(pageBreaks.length + 1, chapters.length);
        });
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async run() {
        try {
            await this.initialize();
            await this.inspectPDF();
            const passed = await this.generateReport();
            await this.cleanup();

            // Exit with appropriate code
            process.exit(passed ? 0 : 1);
        } catch (error) {
            console.error(`${colors.red}${colors.bold}❌ QA Agent Error:${colors.reset} ${error.message}`);
            await this.cleanup();
            process.exit(1);
        }
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`${colors.yellow}Usage: node qa-agent.js <pdf-path>${colors.reset}`);
        console.log(`${colors.yellow}       npm run qa${colors.reset}`);
        process.exit(1);
    }

    const pdfPath = path.resolve(args[0]);
    
    if (!fs.existsSync(pdfPath)) {
        // Try default location
        const defaultPath = path.join(__dirname, '../build/dist/adhd-book-ultimate.pdf');
        if (fs.existsSync(defaultPath)) {
            const agent = new PDFQualityAgent(defaultPath);
            agent.run();
        } else {
            console.error(`${colors.red}Error: PDF file not found: ${pdfPath}${colors.reset}`);
            console.error(`${colors.yellow}Also checked: ${defaultPath}${colors.reset}`);
            process.exit(1);
        }
    } else {
        const agent = new PDFQualityAgent(pdfPath);
        agent.run();
    }
}

module.exports = PDFQualityAgent;