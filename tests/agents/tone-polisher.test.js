const TonePolisher = require('../../agents/tone-polisher');
const fs = require('fs').promises;
const path = require('path');

describe('TonePolisher Agent', () => {
  let polisher;
  let testDir;

  beforeEach(async () => {
    polisher = new TonePolisher({
      brandVoice: 'conversational',
      preserveData: true
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
    expect(polisher).toBeDefined();
    expect(polisher).toBeInstanceOf(TonePolisher);
  });

  test('should have correct configuration', () => {
    expect(polisher.brandVoice).toBe('conversational');
    expect(polisher.preserveData).toBe(true);
    expect(polisher.model).toBe('claude-3-opus-20240229');
  });

  test('should polish single HTML file', async () => {
    // Create test HTML file
    const testContent = `
      <html>
        <body>
          <h1>Test Chapter</h1>
          <p>This is very technical content that needs to be more conversational.</p>
          <p>The algorithm iterates through the array with O(n) complexity.</p>
        </body>
      </html>
    `;
    
    const testFile = path.join(testDir, 'test.html');
    await fs.writeFile(testFile, testContent);
    
    // Polish the file
    const result = await polisher.polishFile(testFile);
    
    expect(result).toHaveProperty('file');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('changes');
    expect(result.success).toBe(true);
  });

  test('should polish entire book directory', async () => {
    // Create test book structure
    const chaptersDir = path.join(testDir, 'chapters');
    await fs.mkdir(chaptersDir, { recursive: true });
    
    await fs.writeFile(
      path.join(chaptersDir, 'chapter-01.html'),
      '<h1>Chapter 1</h1><p>Technical jargon here.</p>'
    );
    
    await fs.writeFile(
      path.join(chaptersDir, 'chapter-02.html'),
      '<h1>Chapter 2</h1><p>More formal language.</p>'
    );
    
    // Polish the book
    const result = await polisher.polishBook(testDir);
    
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('results');
    expect(result.summary).toHaveProperty('totalFiles');
    expect(result.summary).toHaveProperty('successful');
    expect(result.summary).toHaveProperty('successRate');
  });

  test('should support different brand voices', () => {
    const professionalPolisher = new TonePolisher({
      brandVoice: 'professional'
    });
    
    expect(professionalPolisher.VOICE_PROFILES['professional']).toBeDefined();
    expect(professionalPolisher.VOICE_PROFILES['professional'].tone).toContain('authoritative');
  });

  test('should analyze tone consistency', async () => {
    const testFile = path.join(testDir, 'test.html');
    await fs.writeFile(testFile, '<p>Test content for tone analysis.</p>');
    
    const analysis = await polisher.analyzeTone(testFile);
    
    expect(analysis).toHaveProperty('formality');
    expect(analysis).toHaveProperty('emotion');
    expect(analysis).toHaveProperty('clarity');
    expect(analysis).toHaveProperty('audience_fit');
    
    // All scores should be between 0 and 1
    expect(analysis.formality).toBeGreaterThanOrEqual(0);
    expect(analysis.formality).toBeLessThanOrEqual(1);
  });

  test('should preserve data when configured', async () => {
    const testContent = '<p>Important data: $123.45 and 67%</p>';
    const testFile = path.join(testDir, 'test.html');
    await fs.writeFile(testFile, testContent);
    
    const result = await polisher.polishFile(testFile);
    
    // Read the polished content
    const polishedContent = await fs.readFile(testFile, 'utf8');
    
    // Data should be preserved
    expect(polishedContent).toContain('$123.45');
    expect(polishedContent).toContain('67%');
  });

  test('should handle errors gracefully', async () => {
    // Test with non-existent file
    const result = await polisher.polishFile('/non/existent/file.html');
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('error');
    expect(result.success).toBe(false);
  });

  test('should track performance metrics', async () => {
    const testFile = path.join(testDir, 'test.html');
    await fs.writeFile(testFile, '<p>Test performance tracking.</p>');
    
    const startTime = Date.now();
    const result = await polisher.polishFile(testFile);
    const endTime = Date.now();
    
    expect(result).toHaveProperty('processingTime');
    expect(result.processingTime).toBeLessThan(endTime - startTime);
  });
});