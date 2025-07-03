// Redirect to cached version
const deepResearchCached = require('./deep-research-cached');

module.exports = async function deepResearch({topic}){
  // Use cached version by default
  return deepResearchCached({ topic });
};