const { getQueueManager, QueueManager } = require('../src/queue/QueueManager');

describe('QueueManager', () => {
  test('exports getQueueManager function', () => {
    expect(typeof getQueueManager).toBe('function');
  });

  test('exports QueueManager class', () => {
    expect(typeof QueueManager).toBe('function');
  });

  test('getQueueManager returns instance with startPipeline method', () => {
    const qm = getQueueManager();
    expect(typeof qm.startPipeline).toBe('function');
  });

  test('QueueManager instance has all required methods', () => {
    const qm = getQueueManager();
    
    // Core methods
    expect(typeof qm.connect).toBe('function');
    expect(typeof qm.addJob).toBe('function');
    expect(typeof qm.getQueueStats).toBe('function');
    expect(typeof qm.getGlobalStats).toBe('function');
    
    // Admin methods
    expect(typeof qm.startPipeline).toBe('function');
    expect(typeof qm.getFailedJobs).toBe('function');
    expect(typeof qm.retryJob).toBe('function');
    expect(typeof qm.clearFailedJobs).toBe('function');
  });

  test('startPipeline returns a pipeline ID', async () => {
    const qm = getQueueManager();
    
    // Mock addJob to avoid Redis dependency
    qm.addJob = jest.fn().mockResolvedValue({ id: 'test-job-id' });
    
    const pipelineId = await qm.startPipeline('Test Topic', { chapters: 1 });
    
    expect(typeof pipelineId).toBe('string');
    expect(pipelineId).toMatch(/^pipeline-\d+-[a-z0-9]+$/);
    expect(qm.addJob).toHaveBeenCalledWith('pipeline', 'start-pipeline', expect.objectContaining({
      topic: 'Test Topic',
      chapters: 1
    }));
  });
});