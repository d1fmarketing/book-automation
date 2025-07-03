const Redis = require('redis');

class RedisTopicBuffer {
  constructor() {
    this.client = null;
    this.TTL = 48 * 60 * 60; // 48 hours in seconds
    this.BUFFER_KEY = 'ebook:topics:buffer';
    this.MAX_TOPICS = 10;
  }

  async connect() {
    if (!this.client) {
      this.client = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      await this.client.connect();
    }
    return this.client;
  }

  async addTopic(topic) {
    try {
      await this.connect();
      
      // Add topic with timestamp
      const topicWithTime = JSON.stringify({
        topic,
        timestamp: Date.now()
      });

      // Add to sorted set with timestamp as score
      await this.client.zAdd(this.BUFFER_KEY, {
        score: Date.now(),
        value: topicWithTime
      });

      // Remove old topics (keep only the most recent MAX_TOPICS)
      const count = await this.client.zCard(this.BUFFER_KEY);
      if (count > this.MAX_TOPICS) {
        await this.client.zRemRangeByRank(this.BUFFER_KEY, 0, count - this.MAX_TOPICS - 1);
      }

      // Set TTL on the buffer
      await this.client.expire(this.BUFFER_KEY, this.TTL);

      console.log(`✅ Added topic to buffer: ${topic}`);
      return true;
    } catch (error) {
      console.error('Error adding topic to buffer:', error);
      return false;
    }
  }

  async isTopicInBuffer(topic) {
    try {
      await this.connect();
      
      // Get all topics from buffer
      const topics = await this.client.zRange(this.BUFFER_KEY, 0, -1);
      
      // Check if topic exists
      for (const topicData of topics) {
        const parsed = JSON.parse(topicData);
        if (parsed.topic.toLowerCase() === topic.toLowerCase()) {
          const age = Date.now() - parsed.timestamp;
          const ageHours = Math.floor(age / (1000 * 60 * 60));
          console.log(`⚠️ Topic "${topic}" found in buffer (${ageHours}h old)`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking topic buffer:', error);
      // Return false on error to allow scanning to continue
      return false;
    }
  }

  async getRecentTopics() {
    try {
      await this.connect();
      
      const topics = await this.client.zRange(this.BUFFER_KEY, 0, -1, { REV: true });
      return topics.map(t => {
        const parsed = JSON.parse(t);
        return {
          ...parsed,
          ageHours: Math.floor((Date.now() - parsed.timestamp) / (1000 * 60 * 60))
        };
      });
    } catch (error) {
      console.error('Error getting recent topics:', error);
      return [];
    }
  }

  async clearBuffer() {
    try {
      await this.connect();
      await this.client.del(this.BUFFER_KEY);
      console.log('✅ Topic buffer cleared');
      return true;
    } catch (error) {
      console.error('Error clearing buffer:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}

module.exports = RedisTopicBuffer;