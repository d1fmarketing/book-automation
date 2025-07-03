const Writer = require('../../agents/writer');
const fs = require('fs').promises;
const path = require('path');

describe('Writer Agent', () => {
  let writer;
  let testDir;
  let mockOutline;

  beforeEach(async () => {
    writer = new Writer({
      style: 'conversational',
      bookType: 'how-to',
      includeResearch: true
    });
    
    // Create test directory
    testDir = path.join(__dirname, 'test-output', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create mock outline
    mockOutline = {
      metadata: {
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test description'
      },
      chapters: [
        {
          number: 1,
          title: 'Introduction',
          description: 'Introduction to the topic',
          keyPoints: ['Point 1', 'Point 2'],
          targetWords: 2000
        },
        {
          number: 2,
          title: 'Getting Started',
          description: 'Basic concepts',
          keyPoints: ['Concept 1', 'Concept 2'],
          targetWords: 2500
        }
      ],
      outputDir: testDir,
      bookType: 'how-to'
    };
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should be instantiable', () => {
    expect(writer).toBeDefined();
    expect(writer).toBeInstanceOf(Writer);
  });

  test('should have correct configuration', () => {
    expect(writer.style).toBe('conversational');
    expect(writer.bookType).toBe('how-to');
    expect(writer.includeResearch).toBe(true);
  });

  test('should generate book from outline', async () => {
    const result = await writer.generateBook(mockOutline, {
      includeAffiliateHooks: true
    });
    
    expect(result).toHaveProperty('totalWords');
    expect(result).toHaveProperty('chapters');
    expect(result).toHaveProperty('filesCreated');
    expect(result.totalWords).toBeGreaterThan(0);
  });

  test('should create chapter files', async () => {
    const result = await writer.generateBook(mockOutline);
    
    // Check if chapter files were created
    const chaptersDir = path.join(testDir, 'chapters');
    const files = await fs.readdir(chaptersDir);
    
    expect(files).toHaveLength(mockOutline.chapters.length);
    expect(files).toContain('chapter-01-introduction.html');
    expect(files).toContain('chapter-02-getting-started.html');
  });

  test('should generate content with target word count', async () => {
    const result = await writer.generateBook(mockOutline);
    
    // Each chapter should meet target word count (with some tolerance)
    result.chapters.forEach((chapter, index) => {
      const targetWords = mockOutline.chapters[index].targetWords;
      const tolerance = 0.2; // 20% tolerance
      
      expect(chapter.wordCount).toBeGreaterThan(targetWords * (1 - tolerance));
      expect(chapter.wordCount).toBeLessThan(targetWords * (1 + tolerance));
    });
  });

  test('should include affiliate hooks when requested', async () => {
    const result = await writer.generateBook(mockOutline, {
      includeAffiliateHooks: true
    });
    
    // Read generated chapter to check for affiliate hooks
    const chapterPath = path.join(testDir, 'chapters', 'chapter-01-introduction.html');
    const content = await fs.readFile(chapterPath, 'utf8');
    
    // Should contain placeholder for affiliate links
    expect(content).toMatch(/\[AFFILIATE:/);
  });

  test('should support different writing styles', () => {
    const academicWriter = new Writer({ style: 'academic' });
    
    expect(academicWriter.WRITING_STYLES['academic']).toBeDefined();
    expect(academicWriter.WRITING_STYLES['academic'].tone).toContain('scholarly');
  });

  test('should generate table of contents', async () => {
    const result = await writer.generateBook(mockOutline);
    
    const tocPath = path.join(testDir, 'toc.html');
    const tocExists = await fs.access(tocPath).then(() => true).catch(() => false);
    
    expect(tocExists).toBe(true);
    
    // Verify TOC content
    const tocContent = await fs.readFile(tocPath, 'utf8');
    expect(tocContent).toContain('Table of Contents');
    expect(tocContent).toContain('Introduction');
    expect(tocContent).toContain('Getting Started');
  });

  test('should count words accurately', () => {
    const text = 'This is a test sentence with exactly eight words.';
    const wordCount = writer.countWords(text);
    
    expect(wordCount).toBe(8);
  });

  test('should handle markdown to HTML conversion', async () => {
    // Create a mock outline with markdown content
    const markdownOutline = {
      ...mockOutline,
      chapters: [{
        number: 1,
        title: 'Test Chapter',
        description: 'Test with **bold** and *italic*',
        keyPoints: ['- List item 1', '- List item 2'],
        targetWords: 100
      }]
    };
    
    const result = await writer.generateBook(markdownOutline);
    
    const chapterPath = path.join(testDir, 'chapters', 'chapter-01-test-chapter.html');
    const content = await fs.readFile(chapterPath, 'utf8');
    
    // Should convert markdown to HTML
    expect(content).toContain('<strong>');
    expect(content).toContain('<em>');
    expect(content).toContain('<ul>');
  });

  test('should include research data when available', async () => {
    // Create mock research file
    const researchPath = path.join(testDir, 'research.yaml');
    await fs.writeFile(researchPath, `
topic: Test Topic
summary: Research summary
links:
  - https://example.com
bullets:
  - Important fact 1
  - Important fact 2
`);
    
    const outlineWithResearch = {
      ...mockOutline,
      researchPath: researchPath
    };
    
    const result = await writer.generateBook(outlineWithResearch);
    
    // Should incorporate research into content
    expect(result.researchIntegrated).toBe(true);
  });

  test('should handle errors gracefully', async () => {
    // Test with invalid outline
    const invalidOutline = {
      metadata: {},
      chapters: []
    };
    
    const result = await writer.generateBook(invalidOutline);
    
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('No chapters to generate');
  });
});