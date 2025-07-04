#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// State machine configuration
const STATES = [
  'PLAN',
  'RESEARCH', 
  'WRITE',
  'POLISH',
  'ILLUSTRATE',
  'FORMAT',
  'QA_FACT',
  'AFFILIATE',
  'QA_HTML',
  'DONE'
];

// Agent mapping
const AGENT_MAPPING = {
  'PLAN': 'plan.outline',
  'RESEARCH': 'research.perplexity',
  'WRITE': 'write.chapter',
  'POLISH': 'style.polish',
  'ILLUSTRATE': 'img.illustrate',
  'FORMAT': 'format.html',
  'QA_FACT': 'qa.fact',
  'AFFILIATE': 'aff.inject',
  'QA_HTML': 'qa.html'
};

// Orchestrator class
class PipelineOrchestrator {
  constructor(topic, options = {}) {
    this.topic = topic;
    this.options = options;
    this.state = 'PLAN';
    this.attempt = 0;
    this.maxAttempts = options.maxAttempts || 10;
    this.manifestPath = path.join('build', 'run-manifest.json');
    this.manifest = {
      topic: topic,
      steps: [],
      timestamp: Date.now() / 1000,
      qa: {},
      final: false,
      errors: []
    };
  }

  async initialize() {
    // Ensure build directory exists
    await fs.mkdir('build', { recursive: true });
    await fs.mkdir('build/logs', { recursive: true });
    
    // Load existing manifest if resuming
    try {
      const existing = await fs.readFile(this.manifestPath, 'utf8');
      const data = JSON.parse(existing);
      if (data.topic === this.topic && !data.final) {
        console.log('📋 Resuming from existing manifest...');
        this.manifest = data;
        // Find last completed step
        const lastStep = this.manifest.steps[this.manifest.steps.length - 1];
        const stateIndex = STATES.findIndex(s => AGENT_MAPPING[s] === lastStep);
        if (stateIndex !== -1 && stateIndex < STATES.length - 1) {
          this.state = STATES[stateIndex + 1];
          console.log(`   Resuming from state: ${this.state}`);
        }
      }
    } catch (e) {
      // No existing manifest, start fresh
    }
    
    await this.saveManifest();
  }

  async saveManifest() {
    this.manifest.timestamp = Date.now() / 1000;
    await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }

  mark(state) {
    const agent = AGENT_MAPPING[state];
    if (agent && !this.manifest.steps.includes(agent)) {
      this.manifest.steps.push(agent);
      console.log(`   ✅ Marked step: ${agent}`);
    }
  }

  async callAgent(agentName, args = {}) {
    console.log(`\n🤖 Calling agent: ${agentName}`);
    
    try {
      // Map agent names to actual implementations
      const agentPaths = {
        'plan.outline': '../agents/planner',
        'research.perplexity': '../agents/deep-research',
        'write.chapter': '../agents/writer',
        'style.polish': '../agents/tone-polisher',
        'img.illustrate': '../agents/illustrator',
        'format.html': '../agents/formatter-html',
        'qa.fact': '../agents/fact-checker',
        'aff.inject': '../agents/affiliate-injector',
        'qa.html': '../qa/qa-html-mcp'
      };

      const agentPath = agentPaths[agentName];
      if (!agentPath) {
        throw new Error(`Unknown agent: ${agentName}`);
      }

      // Special handling for different agents
      switch (agentName) {
        case 'plan.outline': {
          const Planner = require(agentPath);
          const planner = new Planner({ bookStyle: 'how-to', depth: 'intermediate' });
          const result = await planner.createOutline(this.topic, {
            chapters: 10,
            outputDir: `build/ebooks/${this.topic.toLowerCase().replace(/\s+/g, '-')}`
          });
          if (!result.success) throw new Error(result.error);
          this.bookDir = result.outline.outputDir;
          return result;
        }

        case 'research.perplexity': {
          const deepResearch = require(agentPath);
          const research = await deepResearch({ topic: this.topic });
          // Save research context
          await fs.mkdir('context', { recursive: true });
          await fs.writeFile('context/research.yaml', 
            `topic: ${this.topic}\nsummary: ${research.summary}\nlinks:\n${research.links.map(l => `  - ${l}`).join('\n')}`
          );
          return research;
        }

        case 'write.chapter': {
          const Writer = require(agentPath);
          const writer = new Writer({ style: 'conversational', includeResearch: true });
          // Load outline
          const outlinePath = path.join(this.bookDir, 'outline.json');
          const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
          const result = await writer.generateBook(outline, { includeAffiliateHooks: true });
          return result;
        }

        case 'style.polish': {
          const TonePolisher = require(agentPath);
          const polisher = new TonePolisher({ brandVoice: 'conversational', preserveData: true });
          const result = await polisher.polishBook(this.bookDir);
          return result;
        }

        case 'img.illustrate': {
          const Illustrator = require(agentPath);
          const illustrator = new Illustrator();
          const result = await illustrator.generateForBook(this.bookDir);
          // Verify images actually exist
          const chapters = await fs.readdir(path.join(this.bookDir, 'chapters'));
          for (const chapter of chapters) {
            const imagePath = path.join(this.bookDir, 'assets', 'images', `${path.basename(chapter, '.md')}.png`);
            try {
              await fs.access(imagePath);
            } catch (e) {
              throw new Error(`Ideogram image missing for ${chapter}`);
            }
          }
          return result;
        }

        case 'format.html': {
          const FormatterHTML = require(agentPath);
          const formatter = new FormatterHTML();
          const result = await formatter.formatBook(this.bookDir);
          return result;
        }

        case 'qa.fact': {
          const FactChecker = require(agentPath);
          const checker = new FactChecker({ maxCalls: 5, strictMode: true });
          const result = await checker.checkBook(this.bookDir);
          if (result.summary.FACT_CHECK_NEEDED) {
            throw new Error('Manual fact-check needed - failing pipeline');
          }
          return result;
        }

        case 'aff.inject': {
          const AffiliateInjector = require(agentPath);
          const injector = new AffiliateInjector({ 
            networks: ['amazon', 'shareasale'],
            strategy: 'natural'
          });
          const result = await injector.processEbookDirectory(this.bookDir);
          return result;
        }

        case 'qa.html': {
          const { runQATests, getLighthouseScore } = require(agentPath);
          const htmlPath = path.join(this.bookDir, 'html', 'index.html');
          const qaResults = await runQATests(htmlPath);
          const lighthouse = await getLighthouseScore(htmlPath);
          
          // Store QA metrics in manifest
          this.manifest.qa = {
            lighthouse: lighthouse.average / 100,
            devicesPass: qaResults.passed,
            totalTests: qaResults.tests.length,
            scores: lighthouse.scores
          };
          
          await this.saveManifest();
          
          // Strict validation
          if (lighthouse.average < 90) {
            throw new Error(`Lighthouse score too low: ${lighthouse.average}/100 (required: 90+)`);
          }
          
          if (qaResults.failed > 0) {
            throw new Error(`QA tests failed: ${qaResults.failed} failures`);
          }
          
          return { qaResults, lighthouse };
        }

        default:
          throw new Error(`Agent ${agentName} not implemented`);
      }
    } catch (error) {
      console.error(`   ❌ Agent failed: ${error.message}`);
      throw error;
    }
  }

  async run() {
    console.log('🚀 ENGENHEIRO BRAVO PIPELINE - ZERO TOLERANCE MODE\n');
    console.log('=' .repeat(60));
    console.log(`Topic: ${this.topic}`);
    console.log(`Max attempts per state: ${this.maxAttempts}`);
    console.log('=' .repeat(60));

    await this.initialize();

    while (this.state !== 'DONE') {
      try {
        console.log(`\n📍 State: ${this.state} (Attempt ${this.attempt + 1}/${this.maxAttempts})`);
        
        switch (this.state) {
          case 'PLAN':
            await this.callAgent('plan.outline');
            this.mark(this.state);
            this.state = 'RESEARCH';
            break;

          case 'RESEARCH':
            await this.callAgent('research.perplexity');
            this.mark(this.state);
            this.state = 'WRITE';
            break;

          case 'WRITE':
            await this.callAgent('write.chapter');
            this.mark(this.state);
            this.state = 'POLISH';
            break;

          case 'POLISH':
            await this.callAgent('style.polish');
            this.mark(this.state);
            this.state = 'ILLUSTRATE';
            break;

          case 'ILLUSTRATE':
            await this.callAgent('img.illustrate');
            this.mark(this.state);
            this.state = 'FORMAT';
            break;

          case 'FORMAT':
            await this.callAgent('format.html');
            this.mark(this.state);
            this.state = 'QA_FACT';
            break;

          case 'QA_FACT':
            const factResult = await this.callAgent('qa.fact');
            this.mark(this.state);
            this.state = 'AFFILIATE';
            break;

          case 'AFFILIATE':
            await this.callAgent('aff.inject');
            this.mark(this.state);
            this.state = 'QA_HTML';
            break;

          case 'QA_HTML':
            const qaResult = await this.callAgent('qa.html');
            this.mark(this.state);
            this.state = 'DONE';
            break;
        }

        // Reset attempt counter on success
        this.attempt = 0;
        await this.saveManifest();

      } catch (error) {
        console.error(`\n⚠️  State ${this.state} failed: ${error.message}`);
        
        // Log error to manifest
        this.manifest.errors.push({
          state: this.state,
          attempt: this.attempt + 1,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        await this.saveManifest();

        // Increment attempt counter
        this.attempt++;
        
        if (this.attempt >= this.maxAttempts) {
          console.error(`\n❌ PIPELINE FAILED: Max attempts (${this.maxAttempts}) reached for state ${this.state}`);
          process.exit(1);
        }

        console.log(`   🔄 Retrying ${this.state} (attempt ${this.attempt + 1}/${this.maxAttempts})...`);
        
        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, this.attempt), 30000);
        console.log(`   ⏳ Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Mark as final
    this.manifest.final = true;
    await this.saveManifest();

    // Final report
    console.log('\n' + '=' .repeat(60));
    console.log('✅ PIPELINE COMPLETE - ALL CHECKS PASSED!');
    console.log('=' .repeat(60));
    console.log('\n📊 MANIFEST SUMMARY:');
    console.log(`   Topic: ${this.manifest.topic}`);
    console.log(`   Steps completed: ${this.manifest.steps.length}`);
    console.log(`   QA Score: ${Math.round(this.manifest.qa.lighthouse * 100)}/100`);
    console.log(`   Errors encountered: ${this.manifest.errors.length}`);
    console.log(`   Book directory: ${this.bookDir}`);
    console.log('\n✅ Ready for deployment!');

    return this.manifest;
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const topic = args[0] || process.env.EBOOK_TOPIC;

  if (!topic) {
    console.error('Usage: node orchestrator.js "<topic>"');
    console.error('   or: EBOOK_TOPIC="<topic>" node orchestrator.js');
    process.exit(1);
  }

  const options = {
    maxAttempts: parseInt(process.env.MAX_ATTEMPTS) || 10
  };

  const orchestrator = new PipelineOrchestrator(topic, options);
  
  orchestrator.run().catch(error => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
}

module.exports = PipelineOrchestrator;