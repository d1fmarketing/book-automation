#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Word blacklists by niche
const BLACKLISTS = {
  // General prohibited terms (illegal, harmful)
  general: [
    'illegal', 'pirated', 'cracked', 'hack', 'exploit',
    'drug', 'weapon', 'violence', 'abuse', 'harm',
    'scam', 'fraud', 'phishing', 'malware', 'virus'
  ],
  
  // Money/Business niche restrictions
  money: [
    'guaranteed profit', 'get rich quick', 'no risk',
    'insider trading', 'ponzi', 'pyramid scheme',
    'money laundering', 'tax evasion'
  ],
  
  // Crypto niche restrictions
  crypto: [
    'pump and dump', 'rug pull', 'exit scam',
    'unregistered securities', 'guaranteed returns',
    'risk-free investment', 'insider information'
  ],
  
  // Adult niche restrictions (extreme content)
  adult: [
    'minor', 'underage', 'child', 'teen',
    'non-consensual', 'forced', 'violence',
    'illegal content', 'trafficking'
  ]
};

// Compliance templates by niche
const DISCLAIMERS = {
  general: `
## Legal Disclaimer

This ebook is for educational and informational purposes only. The author and publisher make no representations or warranties with respect to the accuracy or completeness of the contents. Always consult with qualified professionals before making decisions based on this information.
`,
  
  money: `
## Financial Disclaimer

This publication is not financial advice. All financial decisions involve risk, and past performance does not guarantee future results. Always consult with a qualified financial advisor before making investment decisions. The author is not responsible for any financial losses incurred as a result of following the strategies in this book.

## Earnings Disclaimer

Any earnings or income statements are estimates only. There is no guarantee that you will earn any money using the techniques and ideas in this book. Your level of success depends on many factors including your skill, knowledge, ability, dedication, and financial situation.
`,
  
  crypto: `
## Cryptocurrency Risk Disclaimer

Cryptocurrency investments are highly volatile and risky. You may lose all of your investment. This content is not financial advice and should not be treated as such. Always do your own research (DYOR) and never invest more than you can afford to lose.

## Regulatory Compliance

Cryptocurrency regulations vary by jurisdiction. It is your responsibility to ensure compliance with all applicable laws and regulations in your area. The information in this book may not be suitable for residents of all countries.
`,
  
  adult: `
## Age Verification Notice

This content is intended for adults 18 years of age or older. By accessing this content, you confirm that you are of legal age in your jurisdiction.

## Content Warning

This ebook contains mature themes and content that may not be suitable for all audiences. Reader discretion is advised.

## Consent and Safety

All content promotes safe, consensual activities between adults. If you or someone you know needs help, please contact appropriate support services in your area.
`
};

// Age gate HTML for adult content
const AGE_GATE_HTML = `
<div id="age-gate-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.95); display: flex; align-items: center; justify-content: center; z-index: 10000;">
  <div style="background: #1f2937; padding: 40px; border-radius: 12px; text-align: center; max-width: 500px; border: 2px solid #dc2626;">
    <h2 style="color: #dc2626; margin-bottom: 20px;">Age Verification Required</h2>
    <p style="color: white; margin-bottom: 20px;">This content is intended for mature audiences only.</p>
    <p style="color: white; margin-bottom: 30px;">Are you 18 years of age or older?</p>
    <div style="display: flex; gap: 20px; justify-content: center;">
      <button onclick="verifyAge(true)" style="padding: 12px 30px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer;">Yes, I'm 18+</button>
      <button onclick="verifyAge(false)" style="padding: 12px 30px; background: #374151; color: white; border: none; border-radius: 6px; cursor: pointer;">No, Exit</button>
    </div>
  </div>
</div>
<script>
function verifyAge(confirmed) {
  if (confirmed) {
    localStorage.setItem('age_verified', 'true');
    document.getElementById('age-gate-overlay').style.display = 'none';
  } else {
    window.location.href = 'https://google.com';
  }
}
// Auto-show if not verified
if (!localStorage.getItem('age_verified')) {
  // Age gate is already visible
} else {
  document.getElementById('age-gate-overlay').style.display = 'none';
}
</script>
`;

// Check content for blacklisted words
async function checkBlacklist(content, niche = 'general') {
  const blacklist = [
    ...BLACKLISTS.general,
    ...(BLACKLISTS[niche] || [])
  ];
  
  const contentLower = content.toLowerCase();
  const foundWords = [];
  
  for (const word of blacklist) {
    // Use word boundaries to avoid false positives
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = contentLower.match(regex);
    if (matches) {
      foundWords.push({
        word,
        count: matches.length,
        context: getContext(content, word)
      });
    }
  }
  
  return foundWords;
}

// Get context around blacklisted word
function getContext(content, word) {
  const regex = new RegExp(`(.{0,50})\\b${word}\\b(.{0,50})`, 'gi');
  const match = regex.exec(content);
  if (match) {
    return `...${match[1]}**${word}**${match[2]}...`;
  }
  return '';
}

// Check all files in a directory
async function checkDirectory(dir, niche = 'general') {
  const results = {
    niche,
    totalFiles: 0,
    filesWithIssues: 0,
    totalIssues: 0,
    violations: []
  };
  
  try {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.html')) continue;
      
      const filePath = path.join(dir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      results.totalFiles++;
      
      const violations = await checkBlacklist(content, niche);
      if (violations.length > 0) {
        results.filesWithIssues++;
        results.totalIssues += violations.length;
        results.violations.push({
          file: filePath,
          violations
        });
      }
    }
  } catch (error) {
    console.error(`Error checking directory: ${error.message}`);
  }
  
  return results;
}

// Add required disclaimers to content
function addDisclaimers(content, niche = 'general') {
  let updatedContent = content;
  
  // Add general disclaimer if not present
  if (!content.includes('Legal Disclaimer') && !content.includes('Disclaimer')) {
    updatedContent += '\n\n' + DISCLAIMERS.general;
  }
  
  // Add niche-specific disclaimer
  if (DISCLAIMERS[niche] && !content.includes(DISCLAIMERS[niche])) {
    updatedContent += '\n\n' + DISCLAIMERS[niche];
  }
  
  return updatedContent;
}

// Add age gate to HTML if adult content
function addAgeGate(htmlContent, niche) {
  if (niche === 'adult' && !htmlContent.includes('age-gate-overlay')) {
    // Insert age gate after opening body tag
    return htmlContent.replace('<body>', '<body>' + AGE_GATE_HTML);
  }
  return htmlContent;
}

// Generate compliance report
async function generateReport(results) {
  const report = `# Compliance Check Report

**Date**: ${new Date().toISOString()}
**Niche**: ${results.niche}
**Total Files Scanned**: ${results.totalFiles}
**Files with Issues**: ${results.filesWithIssues}
**Total Violations**: ${results.totalIssues}

## Violations Found

${results.violations.length === 0 ? '✅ No violations found!' : results.violations.map(v => `
### ${v.file}
${v.violations.map(viol => `
- **Word**: "${viol.word}" (found ${viol.count} times)
  - Context: ${viol.context}
`).join('')}
`).join('')}

## Recommendations

${results.totalIssues > 0 ? `
1. Review and revise the flagged content
2. Consider rephrasing to avoid blacklisted terms
3. Ensure all content complies with platform policies
4. Add appropriate disclaimers and warnings
` : `
1. Content appears compliant
2. Consider adding disclaimers for extra protection
3. Regular compliance checks recommended
`}

## Disclaimers Added

The following disclaimers should be included:
- General disclaimer
${results.niche !== 'general' ? `- ${results.niche.charAt(0).toUpperCase() + results.niche.slice(1)} specific disclaimer` : ''}
${results.niche === 'adult' ? '- Age verification gate' : ''}
`;
  
  return report;
}

// Main compliance check function
async function runComplianceCheck(options = {}) {
  const {
    directory = 'build/ebooks',
    niche = 'general',
    fix = false,
    outputReport = true
  } = options;
  
  console.log('🔍 Running Compliance Check...\n');
  console.log(`Directory: ${directory}`);
  console.log(`Niche: ${niche}`);
  console.log(`Auto-fix: ${fix ? 'Yes' : 'No'}\n`);
  
  // Check for violations
  const results = await checkDirectory(directory, niche);
  
  // Generate report
  const report = await generateReport(results);
  
  if (outputReport) {
    const reportPath = path.join(directory, 'compliance-report.md');
    await fs.writeFile(reportPath, report);
    console.log(`📄 Report saved to: ${reportPath}`);
  }
  
  // Display summary
  console.log('\n📊 Summary:');
  console.log(`Total files: ${results.totalFiles}`);
  console.log(`Files with issues: ${results.filesWithIssues}`);
  console.log(`Total violations: ${results.totalIssues}`);
  
  if (results.totalIssues > 0) {
    console.log('\n⚠️  Violations found! Review the report for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All content passed compliance check!');
  }
  
  return results;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    directory: args[0] || 'build/ebooks',
    niche: args[1] || 'general',
    fix: args.includes('--fix')
  };
  
  runComplianceCheck(options).catch(console.error);
}

module.exports = {
  checkBlacklist,
  checkDirectory,
  addDisclaimers,
  addAgeGate,
  runComplianceCheck,
  BLACKLISTS,
  DISCLAIMERS
};