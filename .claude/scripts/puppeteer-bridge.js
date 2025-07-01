#!/usr/bin/env node

/**
 * Puppeteer Bridge for Claude Elite
 * Connects to Puppeteer MCP for browser automation
 */

const path = require('path');
const { spawn } = require('child_process');
const cache = require('../helpers/cache');

// MCP server configuration
const PUPPETEER_MCP_PATH = path.join(process.cwd(), 'src/mcp/puppeteer');
const MCP_PORT = process.env.PUPPETEER_MCP_PORT || 3030;

let mcpServer = null;

/**
 * Start Puppeteer MCP server
 */
async function startMCPServer() {
  if (mcpServer) {
    console.log('Puppeteer MCP already running');
    return;
  }

  return new Promise((resolve, reject) => {
    console.log('Starting Puppeteer MCP server...');
    
    mcpServer = spawn('npm', ['start'], {
      cwd: PUPPETEER_MCP_PATH,
      env: { ...process.env, PORT: MCP_PORT }
    });

    mcpServer.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running') || output.includes('started')) {
        console.log('✅ Puppeteer MCP server started');
        resolve();
      }
    });

    mcpServer.stderr.on('data', (data) => {
      console.error('MCP Error:', data.toString());
    });

    mcpServer.on('error', (error) => {
      console.error('Failed to start MCP:', error);
      reject(error);
    });

    // Give it time to start
    setTimeout(() => {
      resolve(); // Assume it started
    }, 3000);
  });
}

/**
 * Stop MCP server
 */
async function stopMCPServer() {
  if (mcpServer) {
    mcpServer.kill();
    mcpServer = null;
  }
}

/**
 * Browser automation functions
 */
class PuppeteerBridge {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser
   */
  async init(options = {}) {
    const puppeteer = require('puppeteer');
    
    this.browser = await puppeteer.launch({
      headless: options.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport
    await this.page.setViewport({
      width: options.width || 1280,
      height: options.height || 720
    });
  }

  /**
   * Navigate to URL
   */
  async goto(url, options = {}) {
    if (!this.page) await this.init();
    
    await this.page.goto(url, {
      waitUntil: options.waitUntil || 'networkidle2',
      timeout: options.timeout || 30000
    });
  }

  /**
   * Take screenshot
   */
  async screenshot(options = {}) {
    if (!this.page) throw new Error('Browser not initialized');
    
    const screenshotOptions = {
      path: options.path,
      fullPage: options.fullPage !== false,
      type: options.type || 'png'
    };

    const buffer = await this.page.screenshot(screenshotOptions);
    
    // Cache screenshot
    if (options.cache) {
      await cache.set('screenshots', [this.page.url()], buffer, 3600);
    }
    
    return buffer;
  }

  /**
   * Extract text content
   */
  async extractText(selector = 'body') {
    if (!this.page) throw new Error('Browser not initialized');
    
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      return element ? element.textContent : '';
    }, selector);
  }

  /**
   * Fill form
   */
  async fillForm(formData) {
    if (!this.page) throw new Error('Browser not initialized');
    
    for (const [selector, value] of Object.entries(formData)) {
      await this.page.type(selector, value);
    }
  }

  /**
   * Click element
   */
  async click(selector) {
    if (!this.page) throw new Error('Browser not initialized');
    
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }

  /**
   * Wait for element
   */
  async waitFor(selector, options = {}) {
    if (!this.page) throw new Error('Browser not initialized');
    
    await this.page.waitForSelector(selector, {
      timeout: options.timeout || 30000,
      visible: options.visible !== false
    });
  }

  /**
   * Execute JavaScript
   */
  async evaluate(fn, ...args) {
    if (!this.page) throw new Error('Browser not initialized');
    
    return await this.page.evaluate(fn, ...args);
  }

  /**
   * Generate PDF
   */
  async pdf(options = {}) {
    if (!this.page) throw new Error('Browser not initialized');
    
    return await this.page.pdf({
      path: options.path,
      format: options.format || 'A4',
      printBackground: options.printBackground !== false,
      margin: options.margin || {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

/**
 * High-level automation functions
 */

/**
 * Capture screenshot of URL
 */
async function captureScreenshot(url, outputPath, options = {}) {
  const bridge = new PuppeteerBridge();
  
  try {
    await bridge.goto(url);
    await bridge.screenshot({ path: outputPath, ...options });
    console.log(`✅ Screenshot saved to ${outputPath}`);
  } finally {
    await bridge.close();
  }
}

/**
 * Extract content from URL
 */
async function extractContent(url, selector = 'body') {
  const bridge = new PuppeteerBridge();
  
  try {
    await bridge.goto(url);
    const content = await bridge.extractText(selector);
    return content;
  } finally {
    await bridge.close();
  }
}

/**
 * Generate PDF from URL
 */
async function generatePDF(url, outputPath, options = {}) {
  const bridge = new PuppeteerBridge();
  
  try {
    await bridge.goto(url);
    await bridge.pdf({ path: outputPath, ...options });
    console.log(`✅ PDF saved to ${outputPath}`);
  } finally {
    await bridge.close();
  }
}

/**
 * Batch screenshot capture
 */
async function batchScreenshots(urls, options = {}) {
  const results = await cache.batchProcess(
    urls,
    async (url) => {
      const bridge = new PuppeteerBridge();
      try {
        await bridge.goto(url);
        const buffer = await bridge.screenshot(options);
        return { url, success: true, buffer };
      } catch (error) {
        return { url, success: false, error: error.message };
      } finally {
        await bridge.close();
      }
    },
    {
      namespace: 'batch-screenshots',
      concurrency: options.concurrency || 3,
      onProgress: options.onProgress
    }
  );
  
  return results;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  async function cli() {
    switch (command) {
      case 'screenshot':
        await captureScreenshot(args[0], args[1] || 'screenshot.png');
        break;
        
      case 'extract':
        const content = await extractContent(args[0], args[1]);
        console.log(content);
        break;
        
      case 'pdf':
        await generatePDF(args[0], args[1] || 'output.pdf');
        break;
        
      case 'start-server':
        await startMCPServer();
        console.log('Server running. Press Ctrl+C to stop.');
        break;
        
      default:
        console.log('Usage:');
        console.log('  puppeteer-bridge screenshot <url> [output.png]');
        console.log('  puppeteer-bridge extract <url> [selector]');
        console.log('  puppeteer-bridge pdf <url> [output.pdf]');
        console.log('  puppeteer-bridge start-server');
    }
  }
  
  cli().catch(console.error);
}

// Cleanup
process.on('exit', () => {
  stopMCPServer();
});

module.exports = {
  PuppeteerBridge,
  captureScreenshot,
  extractContent,
  generatePDF,
  batchScreenshots,
  startMCPServer,
  stopMCPServer
};