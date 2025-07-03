// Global test setup for mocking external dependencies

// Mock agentcli calls
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn((command) => {
    if (command.includes('agentcli')) {
      // Mock agentcli responses
      if (command.includes('call claude.opus')) {
        return JSON.stringify({
          response: 'Mocked Claude response',
          success: true
        });
      }
      return '';
    }
    return jest.requireActual('child_process').execSync(command);
  })
}));

// Mock external API calls
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { success: true } })),
  post: jest.fn(() => Promise.resolve({ data: { success: true } })),
  patch: jest.fn(() => Promise.resolve({ data: { success: true } }))
}));

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve('OK')),
    sadd: jest.fn(() => Promise.resolve(1)),
    sismember: jest.fn(() => Promise.resolve(0))
  }))
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.PERPLEXITY_API_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-key';
process.env.IDEOGRAM_API_KEY = 'test-key';
process.env.GUMROAD_ACCESS_TOKEN = 'test-token';
process.env.AMAZON_ASSOCIATE_TAG = 'test-20';

// Suppress console output during tests
if (process.env.SILENT_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
}

// Clean up test artifacts after all tests
afterAll(async () => {
  // Clean up any test directories
  const fs = require('fs').promises;
  const path = require('path');
  const testOutputDir = path.join(__dirname, 'agents', 'test-output');
  
  try {
    await fs.rm(testOutputDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore if directory doesn't exist
  }
});