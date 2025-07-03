const FactChecker = require('../../agents/fact-checker');
const fs = require('fs').promises;
const path = require('path');

describe('FactChecker Agent', () => {
  let factChecker;
  let testDir;

  beforeEach(async () => {
    factChecker = new FactChecker({
      maxCalls: 5,
      strictMode: false
    });
    
    // Create test directory
    testDir = path.join(__dirname, 'test-output', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should be instantiable', () => {
    expect(factChecker).toBeDefined();
    expect(factChecker).toBeInstanceOf(FactChecker);
  });

  test('should have correct configuration', () => {
    expect(factChecker.maxCalls).toBe(5);
    expect(factChecker.strictMode).toBe(false);
  });

  test('should check single HTML file', async () => {
    // Create test HTML file
    const testContent = `
      <html>
        <body>
          <p>This is a test paragraph with correct grammar.</p>
          <p>This sentense has a spelling error.</p>
        </body>
      </html>
    `;
    
    const testFile = path.join(testDir, 'test.html');
    await fs.writeFile(testFile, testContent);
    
    // Check the file
    const result = await factChecker.checkFile(testFile);
    
    expect(result).toHaveProperty('file');
    expect(result).toHaveProperty('grammarErrors');
    expect(result).toHaveProperty('factChecks');
    expect(result.grammarErrors.length).toBeGreaterThan(0);
  });

  test('should check entire book directory', async () => {
    // Create test book structure
    const chaptersDir = path.join(testDir, 'chapters');
    await fs.mkdir(chaptersDir, { recursive: true });
    
    await fs.writeFile(
      path.join(chaptersDir, 'chapter-01.html'),
      '<p>Chapter 1 content.</p>'
    );
    
    await fs.writeFile(
      path.join(chaptersDir, 'chapter-02.html'),
      '<p>Chapter 2 content with an error.</p>'
    );
    
    // Check the book
    const result = await factChecker.checkBook(testDir);
    
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('results');
    expect(result.summary).toHaveProperty('totalFiles');
    expect(result.summary).toHaveProperty('totalGrammarErrors');
    expect(result.summary).toHaveProperty('passRate');
  });

  test('should respect rate limiting', async () => {
    // This test would need mocking of the actual API calls
    // For now, just test that the rate limiter exists
    expect(factChecker.RATE_LIMIT).toBeDefined();
    expect(factChecker.RATE_LIMIT.maxCalls).toBe(5);
    expect(factChecker.RATE_LIMIT.windowMs).toBe(60 * 60 * 1000); // 1 hour
  });

  test('should handle errors gracefully', async () => {
    // Test with non-existent file
    const result = await factChecker.checkFile('/non/existent/file.html');
    
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Failed to read file');
  });

  test('should return proper report structure', async () => {
    const testFile = path.join(testDir, 'test.html');
    await fs.writeFile(testFile, '<p>Test content.</p>');
    
    const result = await factChecker.checkFile(testFile);
    
    // Verify report structure
    expect(result).toMatchObject({
      file: expect.any(String),
      grammarErrors: expect.any(Array),
      factChecks: expect.any(Array),
      aiClaims: expect.any(Array),
      FACT_CHECK_NEEDED: expect.any(Boolean)
    });
  });
});