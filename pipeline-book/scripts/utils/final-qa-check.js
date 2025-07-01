#!/usr/bin/env node

const pdfParse = require('pdf-parse');
const fs = require('fs-extra');
const path = require('path');

const PDF_PATH = path.join(__dirname, 'the-claude-elite-pipeline-FINAL.pdf');

async function finalQACheck() {
    console.log('🔍 Running FINAL Quality Assurance Check...\n');
    
    const results = {
        passed: [],
        failed: []
    };
    
    try {
        // Check file
        const stats = await fs.stat(PDF_PATH);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        // Parse PDF
        const pdfBuffer = await fs.readFile(PDF_PATH);
        const pdfData = await pdfParse(pdfBuffer);
        
        // Run all checks
        const checks = [
            {
                name: 'File Size',
                test: () => sizeMB < 10,
                result: `${sizeMB} MB (should be < 10 MB)`
            },
            {
                name: 'Page Count',
                test: () => pdfData.numpages >= 30,
                result: `${pdfData.numpages} pages`
            },
            {
                name: 'Title Present',
                test: () => pdfData.text.includes('The Claude Elite Pipeline'),
                result: 'Found in PDF'
            },
            {
                name: 'Author Present',
                test: () => pdfData.text.includes('Claude Elite Team'),
                result: 'Found in PDF'
            },
            {
                name: 'Table of Contents',
                test: () => pdfData.text.includes('Table of Contents'),
                result: 'Found in PDF'
            },
            {
                name: 'All 5 Chapters',
                test: () => {
                    for (let i = 1; i <= 5; i++) {
                        if (!pdfData.text.includes(`Chapter ${i}`)) return false;
                    }
                    return true;
                },
                result: 'All chapters found'
            },
            {
                name: 'Copyright Info',
                test: () => pdfData.text.includes('Copyright') && pdfData.text.includes('2024'),
                result: 'Copyright notice present'
            },
            {
                name: 'ISBN',
                test: () => pdfData.text.includes('ISBN'),
                result: 'ISBN present'
            },
            {
                name: 'Publisher Info',
                test: () => pdfData.text.includes('TechBooks Press'),
                result: 'Publisher info found'
            },
            {
                name: 'Chapter Titles',
                test: () => {
                    const titles = [
                        'The Vision of Automated Publishing',
                        'The Five Agents',
                        'From Theory to Practice',
                        'Professional Publishing',
                        'The Future'
                    ];
                    return titles.every(title => 
                        pdfData.text.includes(title) || 
                        pdfData.text.includes(title.substring(0, 15))
                    );
                },
                result: 'All chapter titles found'
            }
        ];
        
        // Run checks
        console.log('Running quality checks...\n');
        
        for (const check of checks) {
            const passed = check.test();
            if (passed) {
                results.passed.push(check);
                console.log(`✅ ${check.name}: ${check.result}`);
            } else {
                results.failed.push(check);
                console.log(`❌ ${check.name}: FAILED`);
            }
        }
        
        // Final report
        console.log('\n' + '═'.repeat(60));
        console.log('FINAL QA REPORT');
        console.log('═'.repeat(60));
        console.log(`Total Checks: ${checks.length}`);
        console.log(`Passed: ${results.passed.length}`);
        console.log(`Failed: ${results.failed.length}`);
        console.log('═'.repeat(60));
        
        if (results.failed.length === 0) {
            console.log('\n🎉 PERFECT! All quality checks passed!');
            console.log('📖 The ebook is ready for publishing!');
            console.log(`\n📁 Final PDF: ${PDF_PATH}`);
            console.log(`📊 Size: ${sizeMB} MB`);
            console.log(`📄 Pages: ${pdfData.numpages}`);
        } else {
            console.log('\n⚠️  Some checks failed. Please review and fix.');
        }
        
    } catch (error) {
        console.error('❌ Error during QA check:', error.message);
    }
}

// Run the final check
finalQACheck();