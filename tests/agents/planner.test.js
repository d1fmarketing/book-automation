const Planner = require('../../agents/planner');
const fs = require('fs').promises;
const path = require('path');

describe('Planner Agent', () => {
  let planner;
  let testDir;

  beforeEach(async () => {
    planner = new Planner({
      bookStyle: 'how-to',
      depth: 'intermediate'
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
    expect(planner).toBeDefined();
    expect(planner).toBeInstanceOf(Planner);
  });

  test('should have correct configuration', () => {
    expect(planner.bookStyle).toBe('how-to');
    expect(planner.depth).toBe('intermediate');
  });

  test('should create book outline', async () => {
    const result = await planner.createOutline('Test Book Topic', {
      chapters: 10,
      outputDir: testDir
    });
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('outline');
    expect(result.success).toBe(true);
    
    const outline = result.outline;
    expect(outline).toHaveProperty('metadata');
    expect(outline).toHaveProperty('chapters');
    expect(outline).toHaveProperty('outputDir');
    expect(outline).toHaveProperty('bookType');
  });

  test('should generate correct number of chapters', async () => {
    const result = await planner.createOutline('Test Book', {
      chapters: 5,
      outputDir: testDir
    });
    
    expect(result.outline.chapters).toHaveLength(5);
    
    // Each chapter should have required properties
    result.outline.chapters.forEach((chapter, index) => {
      expect(chapter).toHaveProperty('number');
      expect(chapter).toHaveProperty('title');
      expect(chapter).toHaveProperty('description');
      expect(chapter).toHaveProperty('keyPoints');
      expect(chapter).toHaveProperty('targetWords');
      expect(chapter.number).toBe(index + 1);
    });
  });

  test('should support different book styles', () => {
    const technicalPlanner = new Planner({
      bookStyle: 'technical'
    });
    
    expect(technicalPlanner.BOOK_STYLES['technical']).toBeDefined();
    expect(technicalPlanner.BOOK_STYLES['technical'].tone).toBe('authoritative');
  });

  test('should include research data when available', async () => {
    // Create mock research file
    const researchPath = path.join(testDir, 'research.yaml');
    await fs.writeFile(researchPath, `
topic: Test Topic
summary: This is test research
links:
  - https://example.com
bullets:
  - Key insight 1
  - Key insight 2
`);
    
    const result = await planner.createOutline('Test Book', {
      chapters: 3,
      researchPath: researchPath,
      outputDir: testDir
    });
    
    expect(result.success).toBe(true);
    // The outline should incorporate research insights
    expect(result.outline.metadata.researchIntegrated).toBe(true);
  });

  test('should save outline to file', async () => {
    const result = await planner.createOutline('Test Book', {
      chapters: 5,
      outputDir: testDir
    });
    
    const outlinePath = path.join(testDir, 'outline.json');
    const fileExists = await fs.access(outlinePath).then(() => true).catch(() => false);
    
    expect(fileExists).toBe(true);
    
    // Verify saved outline structure
    const savedOutline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
    expect(savedOutline).toHaveProperty('metadata');
    expect(savedOutline).toHaveProperty('chapters');
  });

  test('should generate appropriate chapter progression', async () => {
    const result = await planner.createOutline('Learn JavaScript', {
      chapters: 10,
      outputDir: testDir
    });
    
    const chapters = result.outline.chapters;
    
    // First chapters should be introductory
    expect(chapters[0].title.toLowerCase()).toMatch(/introduction|basics|overview/);
    
    // Last chapters should be advanced/conclusion
    const lastChapter = chapters[chapters.length - 1];
    expect(lastChapter.title.toLowerCase()).toMatch(/advanced|conclusion|future|next/);
  });

  test('should calculate total word count', async () => {
    const result = await planner.createOutline('Test Book', {
      chapters: 5,
      outputDir: testDir
    });
    
    const totalWords = result.outline.chapters.reduce(
      (sum, chapter) => sum + chapter.targetWords, 
      0
    );
    
    expect(totalWords).toBeGreaterThan(0);
    expect(result.outline.metadata.targetWords).toBe(totalWords);
  });

  test('should handle errors gracefully', async () => {
    const result = await planner.createOutline('', {
      chapters: 0,
      outputDir: '/invalid/path'
    });
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('error');
    expect(result.success).toBe(false);
  });

  test('should adapt depth to content', () => {
    const beginnerPlanner = new Planner({ depth: 'beginner' });
    const advancedPlanner = new Planner({ depth: 'advanced' });
    
    expect(beginnerPlanner.DEPTH_PROFILES['beginner']).toBeDefined();
    expect(advancedPlanner.DEPTH_PROFILES['advanced']).toBeDefined();
    
    // Different depths should have different characteristics
    expect(beginnerPlanner.DEPTH_PROFILES['beginner'].explanationLevel)
      .not.toBe(advancedPlanner.DEPTH_PROFILES['advanced'].explanationLevel);
  });
});