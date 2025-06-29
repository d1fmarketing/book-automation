#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

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

// Critical content requirements
const CONTENT_REQUIREMENTS = {
    title: {
        expected: "TDAH Descomplicado",
        critical: true
    },
    subtitle: {
        expected: "10 Estratégias Infalíveis para Nunca Mais Perder Suas Coisas",
        critical: true
    },
    author: {
        expected: "Especialista em Produtividade TDAH",
        critical: true
    },
    forbiddenContent: [
        // These should NEVER appear in the visible PDF
        "---",  // YAML frontmatter delimiter
        "words:",
        "words_target:",
        "chap:",
        "status:",
        "Título do Seu Livro",
        "Subtítulo Opcional",
        "Seu Nome",
        "```", // Code blocks
        "undefined",
        "null",
        "<script",  // Scripts should never appear
        "<?php"     // PHP code should never appear
    ],
    requiredImages: [
        "organized_entryway_w_38d6d543",
        "collection_of_tracki_cc0ad977",
        "person_at_doorway_do_4ac68c7c",
        "stylish_accessories_6cd3ecd9",
        "collection_of_everyd_b4ab6690",
        "person_doing_morning_8c0d3f8f",
        "organized_drawer_sho_a4457e98",
        "organized_entryway_d_91a5f341",
        "smartphone_screen_sh_0fb8d684",
        "person_practicing_qu_78231beb"
    ],
    minImages: 10  // Minimum number of images expected
};

class ContentValidator {
    constructor() {
        this.criticalErrors = [];
        this.errors = [];
        this.warnings = [];
        this.passed = true;
    }

    async validatePDFContent(htmlPath) {
        console.log(`${colors.cyan}${colors.bold}📋 Content Validator v1.0${colors.reset}`);
        console.log(`${colors.blue}Validating content integrity...${colors.reset}\n`);

        if (!fs.existsSync(htmlPath)) {
            this.criticalErrors.push({
                type: 'file',
                message: `HTML file not found: ${htmlPath}`
            });
            return false;
        }

        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Validate metadata
        this.validateMetadata(htmlContent);
        
        // Check for forbidden content
        this.checkForbiddenContent(htmlContent);
        
        // Validate images
        this.validateImages(htmlContent);
        
        // Check chapter structure
        this.validateChapterStructure(htmlContent);
        
        // Generate report
        return this.generateReport(htmlPath);
    }

    validateMetadata(html) {
        console.log(`${colors.blue}Checking metadata...${colors.reset}`);
        
        // Check title
        if (!html.includes(CONTENT_REQUIREMENTS.title.expected)) {
            this.criticalErrors.push({
                type: 'metadata',
                field: 'title',
                message: `Title "${CONTENT_REQUIREMENTS.title.expected}" not found in PDF`,
                expected: CONTENT_REQUIREMENTS.title.expected,
                critical: true
            });
        } else {
            console.log(`${colors.green}✓ Title correct${colors.reset}`);
        }
        
        // Check subtitle
        if (!html.includes(CONTENT_REQUIREMENTS.subtitle.expected)) {
            this.criticalErrors.push({
                type: 'metadata',
                field: 'subtitle',
                message: `Subtitle not found in PDF`,
                expected: CONTENT_REQUIREMENTS.subtitle.expected,
                critical: true
            });
        } else {
            console.log(`${colors.green}✓ Subtitle correct${colors.reset}`);
        }
        
        // Check author
        if (!html.includes(CONTENT_REQUIREMENTS.author.expected)) {
            this.criticalErrors.push({
                type: 'metadata',
                field: 'author',
                message: `Author not found in PDF`,
                expected: CONTENT_REQUIREMENTS.author.expected,
                critical: true
            });
        } else {
            console.log(`${colors.green}✓ Author correct${colors.reset}`);
        }
        
        // Check for wrong metadata
        if (html.includes("Título do Seu Livro")) {
            this.criticalErrors.push({
                type: 'metadata',
                message: `Generic template title found in PDF!`,
                critical: true
            });
        }
    }

    checkForbiddenContent(html) {
        console.log(`\n${colors.blue}Checking for forbidden content...${colors.reset}`);
        
        CONTENT_REQUIREMENTS.forbiddenContent.forEach(forbidden => {
            if (html.includes(forbidden)) {
                // Count occurrences
                const occurrences = (html.match(new RegExp(forbidden, 'g')) || []).length;
                
                this.criticalErrors.push({
                    type: 'forbidden_content',
                    content: forbidden,
                    occurrences: occurrences,
                    message: `Forbidden content "${forbidden}" found ${occurrences} times`,
                    critical: true
                });
                console.log(`${colors.red}✗ Found forbidden: "${forbidden}" (${occurrences}x)${colors.reset}`);
            }
        });
        
        // Check specifically for YAML frontmatter patterns
        const yamlPattern = /---[\s\S]*?---/g;
        const yamlMatches = html.match(yamlPattern);
        if (yamlMatches) {
            this.criticalErrors.push({
                type: 'yaml_frontmatter',
                occurrences: yamlMatches.length,
                message: `YAML frontmatter found in PDF content (${yamlMatches.length} blocks)`,
                critical: true
            });
            console.log(`${colors.red}✗ YAML frontmatter detected!${colors.reset}`);
        }
        
        if (this.criticalErrors.filter(e => e.type === 'forbidden_content').length === 0) {
            console.log(`${colors.green}✓ No forbidden content found${colors.reset}`);
        }
    }

    validateImages(html) {
        console.log(`\n${colors.blue}Checking images...${colors.reset}`);
        
        const imgTags = html.match(/<img[^>]+>/g) || [];
        const foundImages = [];
        
        imgTags.forEach(tag => {
            const srcMatch = tag.match(/src="([^"]+)"/);
            if (srcMatch) {
                foundImages.push(srcMatch[1]);
            }
        });
        
        console.log(`Found ${foundImages.length} images in HTML`);
        
        // Check for required images
        CONTENT_REQUIREMENTS.requiredImages.forEach(requiredImg => {
            const found = foundImages.some(img => img.includes(requiredImg));
            if (!found) {
                this.errors.push({
                    type: 'missing_image',
                    image: requiredImg,
                    message: `Required image "${requiredImg}" not found`
                });
                console.log(`${colors.yellow}⚠ Missing image: ${requiredImg}${colors.reset}`);
            } else {
                console.log(`${colors.green}✓ Found image: ${requiredImg}${colors.reset}`);
            }
        });
    }

    validateChapterStructure(html) {
        console.log(`\n${colors.blue}Checking chapter structure...${colors.reset}`);
        
        // Count chapters
        const chapterDivs = (html.match(/<div class="chapter"/g) || []).length;
        const h1Tags = (html.match(/<h1/g) || []).length;
        
        console.log(`Chapters found: ${chapterDivs}`);
        console.log(`H1 tags found: ${h1Tags}`);
        
        if (chapterDivs < 10) {
            this.errors.push({
                type: 'structure',
                message: `Only ${chapterDivs} chapters found, expected 10+`,
                found: chapterDivs,
                expected: 10
            });
        }
        
        // Check for proper content
        const tips = [];
        for (let i = 1; i <= 10; i++) {
            if (html.includes(`Dica ${i}:`)) {
                tips.push(i);
            }
        }
        
        if (tips.length < 10) {
            this.errors.push({
                type: 'content',
                message: `Only ${tips.length} tips found, expected 10`,
                found: tips.length,
                expected: 10,
                missing: Array.from({length: 10}, (_, i) => i + 1).filter(n => !tips.includes(n))
            });
        } else {
            console.log(`${colors.green}✓ All 10 tips found${colors.reset}`);
        }
    }

    generateReport(htmlPath) {
        console.log(`\n${colors.bold}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.cyan}${colors.bold}CONTENT VALIDATION REPORT${colors.reset}`);
        console.log(`${'='.repeat(60)}\n`);

        const totalCritical = this.criticalErrors.length;
        const totalErrors = this.errors.length;
        const totalWarnings = this.warnings.length;

        console.log(`${colors.bold}Results:${colors.reset}`);
        console.log(`  Critical Errors: ${colors.red}${totalCritical}${colors.reset}`);
        console.log(`  Errors: ${colors.yellow}${totalErrors}${colors.reset}`);
        console.log(`  Warnings: ${colors.blue}${totalWarnings}${colors.reset}\n`);

        if (totalCritical > 0) {
            console.log(`${colors.red}${colors.bold}🚨 CRITICAL ERRORS (MUST FIX):${colors.reset}`);
            this.criticalErrors.forEach((error, idx) => {
                console.log(`${colors.red}${idx + 1}. ${error.message}${colors.reset}`);
                if (error.expected) {
                    console.log(`   Expected: "${error.expected}"`);
                }
            });
            console.log('');
        }

        if (totalErrors > 0) {
            console.log(`${colors.yellow}${colors.bold}⚠️  ERRORS:${colors.reset}`);
            this.errors.forEach((error, idx) => {
                console.log(`${colors.yellow}${idx + 1}. ${error.message}${colors.reset}`);
            });
            console.log('');
        }

        // Final verdict
        const passed = totalCritical === 0;
        
        if (passed) {
            console.log(`${colors.green}${colors.bold}✅ CONTENT VALIDATION: PASSED${colors.reset}`);
            console.log(`${colors.green}Content is ready for QA typography checks${colors.reset}`);
        } else {
            console.log(`${colors.red}${colors.bold}❌ CONTENT VALIDATION: FAILED${colors.reset}`);
            console.log(`${colors.red}Fix all critical errors before proceeding${colors.reset}`);
        }

        // Save detailed report
        const reportPath = path.join(path.dirname(htmlPath), 'content-validation-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            passed: passed,
            summary: {
                criticalErrors: totalCritical,
                errors: totalErrors,
                warnings: totalWarnings
            },
            criticalErrors: this.criticalErrors,
            errors: this.errors,
            warnings: this.warnings
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n${colors.blue}Detailed report saved to: ${path.basename(reportPath)}${colors.reset}`);

        return passed;
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`${colors.yellow}Usage: node content-validator.js <html-path>${colors.reset}`);
        process.exit(1);
    }

    const htmlPath = path.resolve(args[0]);
    const validator = new ContentValidator();
    
    validator.validatePDFContent(htmlPath).then(passed => {
        process.exit(passed ? 0 : 1);
    });
}

module.exports = ContentValidator;