#!/usr/bin/env node

/**
 * Verify No PDF Script
 * Ensures no PDF generation code or files exist in the project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verifying NO PDF in the pipeline...\n');

let hasIssues = false;

// 1. Check environment variable
console.log('1️⃣ Checking environment variable...');
if (process.env.GENERATE_PDF !== 'false') {
  console.log('   ❌ GENERATE_PDF not set to false');
  hasIssues = true;
} else {
  console.log('   ✅ GENERATE_PDF=false');
}

// 2. Check for PDF files in build directories
console.log('\n2️⃣ Checking for PDF files...');
try {
  const pdfFiles = execSync('find build dist -name "*.pdf" 2>/dev/null || true', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(f => f);
  
  if (pdfFiles.length > 0 && pdfFiles[0] !== '') {
    console.log(`   ❌ Found ${pdfFiles.length} PDF files:`);
    pdfFiles.forEach(f => console.log(`      - ${f}`));
    hasIssues = true;
  } else {
    console.log('   ✅ No PDF files found');
  }
} catch (e) {
  console.log('   ✅ No PDF files found');
}

// 3. Check package.json for PDF scripts
console.log('\n3️⃣ Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const pdfScripts = Object.entries(packageJson.scripts || {})
  .filter(([name, cmd]) => name.includes('pdf') || cmd.includes('pdf'))
  .filter(([name]) => !['qa:pdf'].includes(name)); // Allow some QA scripts

if (pdfScripts.length > 0) {
  console.log(`   ⚠️  Found ${pdfScripts.length} PDF-related scripts (may be deprecated):`);
  pdfScripts.forEach(([name]) => console.log(`      - ${name}`));
} else {
  console.log('   ✅ No active PDF scripts');
}

// 4. Check for PDF generation scripts
console.log('\n4️⃣ Checking for PDF generation scripts...');
const pdfGenerators = [
  'scripts/generate-pdf-ultra.js',
  'scripts/generate-pdf.js',
  'scripts/build-pdf.js',
  'scripts/pdf-utils/'
];

const foundGenerators = pdfGenerators.filter(f => {
  try {
    fs.accessSync(f);
    return true;
  } catch (e) {
    return false;
  }
});

if (foundGenerators.length > 0) {
  console.log(`   ❌ Found ${foundGenerators.length} PDF generators:`);
  foundGenerators.forEach(f => console.log(`      - ${f}`));
  hasIssues = true;
} else {
  console.log('   ✅ No PDF generators in scripts/');
}

// 5. Check orchestrator state machine
console.log('\n5️⃣ Checking orchestrator state machine...');
try {
  const orchestrator = fs.readFileSync('scripts/orchestrator.js', 'utf8');
  
  if (orchestrator.includes("state = 'PDF'") || orchestrator.includes('case \'PDF\':')) {
    console.log('   ❌ Orchestrator contains PDF state');
    hasIssues = true;
  } else if (orchestrator.includes("state = 'DONE'") && orchestrator.includes('QA_HTML')) {
    console.log('   ✅ Orchestrator goes directly from QA_HTML to DONE');
  } else {
    console.log('   ⚠️  Could not verify orchestrator flow');
  }
} catch (e) {
  console.log('   ⚠️  Could not read orchestrator.js');
}

// 6. Check manifest validation
console.log('\n6️⃣ Checking CI/CD manifest gate...');
try {
  const manifestGate = fs.readFileSync('.github/workflows/manifest-gate.yml', 'utf8');
  
  if (manifestGate.includes('PDF generation detected')) {
    console.log('   ✅ Manifest gate blocks PDF generation');
  } else {
    console.log('   ⚠️  Manifest gate may not block PDF');
  }
} catch (e) {
  console.log('   ⚠️  Could not read manifest-gate.yml');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasIssues) {
  console.log('❌ ISSUES FOUND! PDF may still be generated.');
  console.log('\nTo fix:');
  console.log('1. Set GENERATE_PDF=false in .env');
  console.log('2. Run: make clean');
  console.log('3. Remove any PDF generation scripts');
  process.exit(1);
} else {
  console.log('✅ ALL CLEAR! No PDF generation detected.');
  console.log('\nThe pipeline will generate HTML/EPUB only.');
}