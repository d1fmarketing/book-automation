/**
 * Sanitize topic name for filesystem usage
 * Removes special characters and creates a clean slug
 */
module.exports = function sanitizeTopic(topic) {
  return topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')    // remove ? ! ' " : ; etc.
    .trim()
    .replace(/\s+/g, '-')        // spaces to hyphens
    .replace(/-+/g, '-')         // multiple hyphens to single
    .slice(0, 60);               // max 60 chars
};