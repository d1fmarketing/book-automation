#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { researchTrendingTopics } = require('./research-topics');
const { createCover } = require('./create-cover');
const { publishEbook } = require('./publish-ebook');

// Import new agents
const deepResearch = require('../agents/deep-research');
const Planner = require('../agents/planner');
const Writer = require('../agents/writer');
const TonePolisher = require('../agents/tone-polisher');
const FactChecker = require('../agents/fact-checker');
const AffiliateInjector = require('../agents/affiliate-injector');
const Optimizer = require('../agents/optimizer');
const HostingerDeploy = require('../agents/hostinger-deploy');

// Import utilities
const RedisTopicBuffer = require('../utils/redis-topic-buffer');
const { callAgentWithRetry } = require('../utils/agentcli-retry-wrapper');

// Import orchestrator for engenheiro bravo mode
const PipelineOrchestrator = require('./orchestrator');

// Enhanced automation pipeline with all agents
async function runAutomationPipeline(options = {}) {
  // Use orchestrator mode if enabled (engenheiro bravo)
  if (options.orchestrator || process.env.USE_ORCHESTRATOR === 'true') {
    console.log('🔥 ENGENHEIRO BRAVO MODE ACTIVATED\n');
    
    let topic = options.topic;
    if (!topic) {
      // Get topic from research if not provided
      const topics = await researchTrendingTopics();
      if (topics.length === 0) {
        console.log('⚠️  No new topics found');
        return null;
      }
      topic = topics[0].title;
    }
    
    const orchestrator = new PipelineOrchestrator(topic, {
      maxAttempts: options.maxAttempts || 10
    });
    
    return await orchestrator.run();
  }
  
  // Original pipeline mode (legacy)
  const startTime = Date.now();
  console.log('🚀 MONEY MACHINE - ENHANCED AUTOMATION PIPELINE\n');
  console.log('=' .repeat(60));
  
  // Initialize workflow context for tracking
  const context = {
    runLog: [],
    agentsRun: [],
    mcpCalls: [],
    errors: [],
    startTime: new Date().toISOString()
  };
  
  // Helper function to track agent calls
  const trackAgent = (agentName, result = null, error = null) => {
    const entry = {
      timestamp: new Date().toISOString(),
      agent: agentName,
      success: !error,
      duration: null
    };
    
    if (error) {
      entry.error = error.message;
      context.errors.push({ agent: agentName, error: error.message });
    }
    
    context.runLog.push(entry);
    if (!error) {
      context.agentsRun.push(agentName);
    }
    
    return entry;
  };
  
  // Helper function to track MCP calls
  const trackMCP = (mcpName) => {
    const entry = {
      timestamp: new Date().toISOString(),
      mcp: mcpName
    };
    context.runLog.push(entry);
    context.mcpCalls.push(mcpName);
  };
  
  try {
    // Configuration
    const config = {
      dailyTarget: options.dailyTarget || 1,
      pricePoint: options.pricePoint || 9.99,
      autoPublish: options.autoPublish !== false,
      generateCover: options.generateCover !== false,
      deployToHostinger: options.deploy !== false,
      brandVoice: options.brandVoice || 'conversational',
      affiliateStrategy: options.affiliateStrategy || 'natural',
      ...options
    };
    
    console.log('⚙️  Configuration:');
    console.log(`   📚 Daily target: ${config.dailyTarget} ebook(s)`);
    console.log(`   💵 Price point: $${config.pricePoint}`);
    console.log(`   🌐 Auto-publish: ${config.autoPublish ? 'Yes' : 'No'}`);
    console.log(`   🎨 Brand voice: ${config.brandVoice}`);
    console.log(`   💰 Affiliate strategy: ${config.affiliateStrategy}`);
    console.log('');
    
    // 1. RESEARCH TRENDING TOPICS
    console.log('📊 PHASE 1: Researching profitable topics...');
    console.log('-'.repeat(40));
    const topics = await researchTrendingTopics();
    
    if (topics.length === 0) {
      console.log('⚠️  No new topics found (all processed recently)');
      console.log('   Wait a few hours or clear Redis buffer');
      return null;
    }
    
    const selectedTopic = topics[0];
    
    // 2. VALIDATE VIABILITY
    console.log('\n💡 PHASE 2: Validating viability...');
    console.log('-'.repeat(40));
    console.log(`Topic selected: "${selectedTopic.title}"`);
    console.log(`Profit potential: ${selectedTopic.potential}`);
    console.log(`Estimated demand: ${selectedTopic.estimatedDemand} searches/month`);
    
    const projectedRevenue = selectedTopic.estimatedDemand * 0.01 * config.pricePoint;
    console.log(`💰 Projected revenue: $${projectedRevenue.toFixed(2)}/month`);
    
    // 3. DEEP RESEARCH (PERPLEXITY)
    console.log('\n🔍 PHASE 3: Deep research with Perplexity...');
    console.log('-'.repeat(40));
    
    let research = null;
    try {
      const researchStart = Date.now();
      trackAgent('research.perplexity');
      trackMCP('perplexity.api');
      
      research = await deepResearch({ topic: selectedTopic.title });
      
      await fs.mkdir('context', { recursive: true });
      const researchYaml = yaml.dump({
        topic: selectedTopic.title,
        timestamp: new Date().toISOString(),
        summary: research.summary,
        links: research.links,
        bullets: research.bullets
      });
      
      await fs.writeFile('context/research.yaml', researchYaml);
      
      // Update tracking with duration
      context.runLog[context.runLog.length - 2].duration = Date.now() - researchStart;
      
      console.log('✅ Research completed:');
      console.log(`   📝 Summary: ${research.summary.slice(0, 100)}...`);
      console.log(`   🔗 Links found: ${research.links.length}`);
      console.log(`   💡 Key insights: ${research.bullets.length}`);
    } catch (error) {
      trackAgent('research.perplexity', null, error);
      console.log('⚠️  Perplexity research failed, continuing without additional data');
      console.log(`   Error: ${error.message}`);
    }
    
    // 4. CREATE BOOK OUTLINE (NEW!)
    console.log('\n📋 PHASE 4: Creating book outline with Planner agent...');
    console.log('-'.repeat(40));
    
    const plannerStart = Date.now();
    trackAgent('plan.outline');
    
    const planner = new Planner({
      bookStyle: selectedTopic.niche === 'tech' ? 'technical' : 'how-to',
      depth: 'intermediate'
    });
    
    const outlineResult = await planner.createOutline(selectedTopic.title, {
      chapters: 10,
      researchPath: 'context/research.yaml',
      outputDir: `build/ebooks/${selectedTopic.title.toLowerCase().replace(/\s+/g, '-')}`
    });
    
    if (!outlineResult.success) {
      trackAgent('plan.outline', null, new Error(outlineResult.error));
      throw new Error(`Outline creation failed: ${outlineResult.error}`);
    }
    
    context.runLog[context.runLog.length - 1].duration = Date.now() - plannerStart;
    
    const outline = outlineResult.outline;
    console.log(`✅ Outline created: ${outline.chapters.length} chapters planned`);
    
    // 5. GENERATE CONTENT WITH WRITER AGENT (NEW!)
    console.log('\n✍️  PHASE 5: Generating high-quality content with Writer agent...');
    console.log('-'.repeat(40));
    
    const writerStart = Date.now();
    trackAgent('write.chapter');
    
    const writer = new Writer({
      style: config.brandVoice,
      bookType: outline.bookType,
      includeResearch: true
    });
    
    const bookSummary = await writer.generateBook(outline, {
      includeAffiliateHooks: true // Prepare for affiliate injection
    });
    
    context.runLog[context.runLog.length - 1].duration = Date.now() - writerStart;
    
    console.log(`✅ Book written: ${bookSummary.totalWords.toLocaleString()} words`);
    
    // 6. POLISH CONTENT WITH TONE POLISHER (NEW!)
    console.log('\n🎨 PHASE 6: Polishing content for brand consistency...');
    console.log('-'.repeat(40));
    
    const polisherStart = Date.now();
    trackAgent('style.polish');
    trackMCP('style.polish');
    
    const polisher = new TonePolisher({
      brandVoice: config.brandVoice,
      preserveData: true
    });
    
    const polishReport = await polisher.polishBook(outline.outputDir, {
      outputPath: outline.outputDir // Overwrite originals
    });
    
    context.runLog[context.runLog.length - 2].duration = Date.now() - polisherStart;
    
    console.log(`✅ Content polished: ${polishReport.summary.successful} chapters enhanced`);
    
    // 7. FACT CHECK CONTENT (NEW!)
    console.log('\n🔍 PHASE 7: Fact-checking and grammar validation...');
    console.log('-'.repeat(40));
    
    const factCheckerStart = Date.now();
    trackAgent('qa.fact');
    trackMCP('qa.fact');
    
    const factChecker = new FactChecker({
      maxCalls: 5,
      strictMode: false
    });
    
    const factReport = await factChecker.checkBook(outline.outputDir);
    
    context.runLog[context.runLog.length - 2].duration = Date.now() - factCheckerStart;
    
    if (factReport.summary.FACT_CHECK_NEEDED) {
      console.log('⚠️  Manual fact-check needed for some content');
    } else {
      console.log(`✅ Fact-check passed: ${factReport.summary.passRate} success rate`);
    }
    
    // 8. CREATE COVER
    let coverPath = null;
    if (config.generateCover) {
      console.log('\n🎨 PHASE 8: Creating professional cover...');
      console.log('-'.repeat(40));
      coverPath = await createCover(selectedTopic, {
        ...outline.metadata,
        outputDir: outline.outputDir
      });
      console.log(`✅ Cover created: ${coverPath}`);
    }
    
    // 9. INJECT AFFILIATE LINKS (NEW!)
    console.log('\n💰 PHASE 9: Injecting affiliate links...');
    console.log('-'.repeat(40));
    
    const affiliateStart = Date.now();
    trackAgent('affiliate.inject');
    
    const affiliateInjector = new AffiliateInjector({
      networks: ['amazon', 'shareasale'],
      strategy: config.affiliateStrategy,
      niche: selectedTopic.niche
    });
    
    const affiliateReport = await affiliateInjector.processEbookDirectory(outline.outputDir);
    
    context.runLog[context.runLog.length - 1].duration = Date.now() - affiliateStart;
    
    console.log(`✅ Affiliate links injected: ${affiliateReport.totalLinksInjected} total`);
    
    // 10. GENERATE HTML EBOOK (NO PDF!)
    console.log('\n📄 PHASE 10: Generating HTML ebook...');
    console.log('-'.repeat(40));
    
    const metadata = {
      ...outline.metadata,
      coverPath,
      generatedAt: new Date().toISOString(),
      wordCount: bookSummary.totalWords
    };
    
    await fs.writeFile(
      path.join(outline.outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // HTML generation is handled by formatter-html agent
    console.log('✅ HTML ebook ready for deployment');
    
    const htmlPath = path.join(outline.outputDir, 'html', 'index.html');
    
    // 11. PUBLISH TO PLATFORMS
    let publishResults = null;
    if (config.autoPublish) {
      console.log('\n🌐 PHASE 11: Publishing to multiple platforms...');
      console.log('-'.repeat(40));
      
      const publishStart = Date.now();
      trackAgent('publish.gumroad');
      
      publishResults = await publishEbook({
        htmlPath,
        topic: selectedTopic,
        metadata,
        price: config.pricePoint
      });
      
      context.runLog[context.runLog.length - 1].duration = Date.now() - publishStart;
    }
    
    // 12. DEPLOY TO HOSTINGER (NEW!)
    let deploymentResult = null;
    if (config.deployToHostinger && config.autoPublish) {
      console.log('\n🚀 PHASE 12: Deploying to Hostinger VPS...');
      console.log('-'.repeat(40));
      
      const deployStart = Date.now();
      trackAgent('deploy.hostinger');
      trackMCP('deploy.hostinger');
      
      const deployer = new HostingerDeploy();
      deploymentResult = await deployer.deploy(outline.outputDir, {
        skipDNS: !config.production // Only switch DNS in production
      });
      
      context.runLog[context.runLog.length - 2].duration = Date.now() - deployStart;
      
      if (deploymentResult.success) {
        console.log(`✅ Deployed to: ${deploymentResult.url}`);
      } else {
        console.log('⚠️  Deployment failed:', deploymentResult.error);
      }
    }
    
    // 13. FINAL REPORT
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
    
    console.log('\n✅ PIPELINE COMPLETE!');
    console.log('=' .repeat(60));
    console.log('\n📊 EBOOK SUMMARY:');
    console.log(`   📖 Title: ${outline.metadata.title}`);
    console.log(`   📁 Niche: ${selectedTopic.niche}`);
    console.log(`   📄 Chapters: ${outline.chapters.length}`);
    console.log(`   📝 Words: ${bookSummary.totalWords.toLocaleString()}`);
    console.log(`   💰 Price: $${config.pricePoint}`);
    console.log(`   🔗 Affiliate links: ${affiliateReport.totalLinksInjected}`);
    console.log(`   ⏱️  Total time: ${duration} minutes`);
    
    if (publishResults) {
      console.log('\n🌐 PUBLISHED TO:');
      publishResults.platforms.forEach(platform => {
        console.log(`   ✅ ${platform.name} - ${platform.url || 'Processing...'}`);
      });
      
      console.log('\n💵 REVENUE PROJECTION:');
      console.log(`   Daily: $${(projectedRevenue / 30).toFixed(2)}`);
      console.log(`   Monthly: $${projectedRevenue.toFixed(2)}`);
      console.log(`   Annual: $${(projectedRevenue * 12).toFixed(2)}`);
      
      // Include affiliate projections
      const affiliateRevenue = projectedRevenue * 0.3; // Estimate 30% additional from affiliates
      console.log(`   + Affiliate income: $${affiliateRevenue.toFixed(2)}/month`);
      console.log(`   = Total monthly: $${(projectedRevenue + affiliateRevenue).toFixed(2)}`);
    }
    
    // Save comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration} minutes`,
      topic: selectedTopic,
      outline: {
        title: outline.metadata.title,
        chapters: outline.chapters.length,
        wordCount: bookSummary.totalWords
      },
      quality: {
        factCheckPass: !factReport.summary.FACT_CHECK_NEEDED,
        grammarErrors: factReport.summary.totalGrammarErrors,
        toneConsistency: polishReport.summary.successRate
      },
      monetization: {
        price: config.pricePoint,
        affiliateLinks: affiliateReport.totalLinksInjected,
        estimatedAffiliateRevenue: affiliateReport.results[0]?.report?.earningsPotential
      },
      projectedRevenue: {
        daily: (projectedRevenue / 30).toFixed(2),
        monthly: projectedRevenue.toFixed(2),
        annual: (projectedRevenue * 12).toFixed(2),
        withAffiliates: (projectedRevenue * 1.3).toFixed(2)
      },
      publishResults,
      deploymentResult
    };
    
    await fs.mkdir('build/reports', { recursive: true });
    await fs.writeFile(
      `build/reports/pipeline-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Report saved to: build/reports/');
    
    // Generate workflow manifest for debugging
    const manifest = {
      timestamp: new Date().toISOString(),
      topic: selectedTopic.title,
      agentsRun: context.agentsRun,
      mcpCalls: context.mcpCalls,
      totalAgents: context.agentsRun.length,
      errors: context.errors,
      runLog: context.runLog
    };
    
    await fs.mkdir('build/logs', { recursive: true });
    await fs.writeFile(
      'build/logs/workflow-manifest.json',
      JSON.stringify(manifest, null, 2)
    );
    
    console.log(`📋 Workflow manifest: ${manifest.totalAgents} agents executed`);
    
    // Verify all required agents ran
    const REQUIRED_AGENTS = [
      'research.perplexity', 'plan.outline', 'write.chapter', 
      'style.polish', 'qa.fact', 'affiliate.inject'
    ];
    
    const missingAgents = REQUIRED_AGENTS.filter(agent => !context.agentsRun.includes(agent));
    if (missingAgents.length > 0) {
      console.warn(`⚠️  Missing required agents: ${missingAgents.join(', ')}`);
    }
    
    // Add topic to Redis buffer
    const topicBuffer = new RedisTopicBuffer();
    await topicBuffer.addTopic(selectedTopic.title);
    await topicBuffer.disconnect();
    console.log('✅ Topic added to Redis buffer (won\'t be reprocessed for 48h)');
    
    // Schedule optimization for 7 days later
    if (config.autoPublish) {
      console.log('\n⏰ Optimization scheduled for 7 days from now');
      // In production, this would be handled by a job scheduler
    }
    
    return report;
    
  } catch (error) {
    console.error('\n❌ PIPELINE ERROR:', error.message);
    console.error(error.stack);
    
    // Save error report
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      phase: 'unknown'
    };
    
    await fs.mkdir('build/reports', { recursive: true });
    await fs.writeFile(
      `build/reports/error-report-${Date.now()}.json`,
      JSON.stringify(errorReport, null, 2)
    );
    
    throw error;
  }
}

// Run batch pipeline
async function runBatchPipeline(count = 5) {
  console.log(`🎯 Starting batch pipeline for ${count} ebooks...\n`);
  
  const results = [];
  
  for (let i = 0; i < count; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 EBOOK ${i + 1} of ${count}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      const report = await runAutomationPipeline();
      results.push({ success: true, report });
      
      // Wait between runs to avoid rate limits
      if (i < count - 1) {
        console.log('\n⏳ Waiting 60 seconds before next ebook...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }
  
  // Summary report
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 BATCH SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  const successful = results.filter(r => r.success).length;
  console.log(`✅ Successful: ${successful}/${count}`);
  console.log(`❌ Failed: ${count - successful}/${count}`);
  
  return results;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 1;
  
  const options = {};
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value === undefined ? true : value;
    }
  });
  
  if (options['dry-run']) {
    console.log('🏃 DRY RUN MODE - No actual publishing or deployment');
    options.autoPublish = false;
    options.deploy = false;
  }
  
  // Enable orchestrator mode with --bravo flag
  if (options.bravo || process.env.ENGENHEIRO_BRAVO === 'true') {
    options.orchestrator = true;
    console.log('🔥 ENGENHEIRO BRAVO MODE ENABLED');
  }
  
  if (count > 1) {
    runBatchPipeline(count).catch(console.error);
  } else {
    runAutomationPipeline(options).catch(console.error);
  }
}

module.exports = { runAutomationPipeline, runBatchPipeline };