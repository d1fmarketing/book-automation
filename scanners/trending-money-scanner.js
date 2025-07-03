const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const RedisTopicBuffer = require('../utils/redis-topic-buffer');

module.exports = async function scan() {
  console.log('🔍 Starting multi-source trend analysis...\n');
  
  const scores = {};
  const sources = [];
  const topicBuffer = new RedisTopicBuffer();
  
  // 1. Google Trends (unofficial API)
  try {
    console.log('📊 Fetching Google Trends...');
    const trends = await fetch('https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=-180&geo=US')
      .then(r => r.text())
      .then(text => {
        // Remove ")]}',\n" prefix from JSONP response
        const jsonStr = text.substring(6);
        return JSON.parse(jsonStr);
      });
    
    if (trends.default && trends.default.trendingSearchesDays) {
      const searches = trends.default.trendingSearchesDays[0].trendingSearches || [];
      searches.forEach(search => {
        const title = search.title.query;
        const traffic = parseInt(search.formattedTraffic.replace(/[^\d]/g, '')) || 0;
        
        // Filter for money-making topics
        const moneyKeywords = ['money', 'earn', 'profit', 'income', 'business', 'crypto', 'invest', 'hustle'];
        if (moneyKeywords.some(keyword => title.toLowerCase().includes(keyword))) {
          scores[title] = (scores[title] || 0) + (traffic / 1000);
          sources.push({ source: 'Google Trends', topic: title, score: traffic / 1000 });
        }
      });
    }
    console.log(`   ✅ Found ${Object.keys(scores).length} money-related trends\n`);
  } catch (error) {
    console.log(`   ⚠️  Google Trends failed: ${error.message}\n`);
  }
  
  // 2. Reddit r/Entrepreneur
  try {
    console.log('📱 Fetching Reddit r/Entrepreneur...');
    const reddit = await fetch('https://www.reddit.com/r/Entrepreneur/hot.json?limit=50', {
      headers: { 'User-Agent': 'EbookGenerator/1.0' }
    }).then(r => r.json());
    
    reddit.data.children.forEach(post => {
      const p = post.data;
      if (p.score > 100) {  // Only high-engagement posts
        const engagement = p.score + (p.num_comments * 10);  // Comments weighted higher
        const title = p.title;
        scores[title] = (scores[title] || 0) + (engagement / 100);
        sources.push({ source: 'Reddit', topic: title, score: engagement / 100 });
      }
    });
    console.log(`   ✅ Found ${reddit.data.children.filter(p => p.data.score > 100).length} high-engagement posts\n`);
  } catch (error) {
    console.log(`   ⚠️  Reddit failed: ${error.message}\n`);
  }
  
  // 3. Hacker News (for tech/startup topics)
  try {
    console.log('💻 Fetching Hacker News...');
    const hn = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
      .then(r => r.json());
    
    // Get top 20 stories
    const storyPromises = hn.slice(0, 20).map(id => 
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
    );
    
    const stories = await Promise.all(storyPromises);
    stories.forEach(story => {
      if (story && story.score > 50) {
        const moneyKeywords = ['startup', 'business', 'revenue', 'saas', 'profit', 'monetize'];
        if (moneyKeywords.some(keyword => (story.title || '').toLowerCase().includes(keyword))) {
          scores[story.title] = (scores[story.title] || 0) + (story.score / 10);
          sources.push({ source: 'HackerNews', topic: story.title, score: story.score / 10 });
        }
      }
    });
    console.log(`   ✅ Found ${stories.filter(s => s && s.score > 50).length} relevant stories\n`);
  } catch (error) {
    console.log(`   ⚠️  Hacker News failed: ${error.message}\n`);
  }
  
  // 4. Product Hunt (for new tools/services)
  try {
    console.log('🚀 Fetching Product Hunt...');
    const today = new Date().toISOString().split('T')[0];
    const ph = await fetch(`https://www.producthunt.com/frontend/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{
          posts(first: 20, order: VOTES) {
            edges {
              node {
                name
                tagline
                votesCount
              }
            }
          }
        }`
      })
    }).then(r => r.json()).catch(() => null);
    
    if (ph && ph.data && ph.data.posts) {
      ph.data.posts.edges.forEach(edge => {
        const post = edge.node;
        if (post.votesCount > 50) {
          const title = `${post.name}: ${post.tagline}`;
          scores[title] = (scores[title] || 0) + (post.votesCount / 10);
          sources.push({ source: 'ProductHunt', topic: title, score: post.votesCount / 10 });
        }
      });
    }
    console.log(`   ✅ Processed Product Hunt data\n`);
  } catch (error) {
    console.log(`   ⚠️  Product Hunt failed: ${error.message}\n`);
  }
  
  // Sort and return top 10
  const sortedTopics = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, score]) => ({
      topic,
      score: Math.round(score),
      sources: sources.filter(s => s.topic === topic).map(s => s.source)
    }));
  
  // Filter out topics already in buffer
  console.log('\n🔄 Checking topic buffer...');
  const filteredTopics = [];
  
  for (const item of sortedTopics) {
    const inBuffer = await topicBuffer.isTopicInBuffer(item.topic);
    if (!inBuffer) {
      filteredTopics.push(item);
    }
  }
  
  // Show recent topics in buffer
  const recentTopics = await topicBuffer.getRecentTopics();
  if (recentTopics.length > 0) {
    console.log('\n📋 Recent topics in buffer:');
    recentTopics.forEach(t => {
      console.log(`   - ${t.topic} (${t.ageHours}h ago)`);
    });
  }
  
  console.log('\n📊 ANALYSIS COMPLETE\n');
  console.log(`Found ${filteredTopics.length} new topics (${sortedTopics.length - filteredTopics.length} filtered by buffer):\n`);
  filteredTopics.forEach((item, i) => {
    console.log(`${i + 1}. ${item.topic}`);
    console.log(`   Score: ${item.score} | Sources: ${item.sources.join(', ')}`);
  });
  
  // Disconnect from Redis
  await topicBuffer.disconnect();
  
  return filteredTopics;
};