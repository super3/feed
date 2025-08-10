const { getStorage } = require('../lib/storage');
const { success, methodNotAllowed, serverError } = require('../lib/utils/error-handler');
const logger = require('../lib/logger');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const storage = getStorage();
    logger.debug('Posts API initialized', { storageType: storage.type, redisType: storage.redisType });
    await storage.init();
    
    const { keyword } = req.query;
    const allPosts = [];
    
    if (keyword) {
      // Get posts for specific keyword
      const keys = await storage.keys(`posts:${keyword}:*`);
      logger.debug('Found post keys for keyword', { keyword, keyCount: keys.length });
      
      for (const key of keys) {
        const data = await storage.get(key);
        if (data && data.posts) {
          allPosts.push(...data.posts);
        }
      }
    } else {
      // Get all posts
      const keys = await storage.keys('posts:*');
      logger.debug('Found total post keys', { keyCount: keys.length });
      
      for (const key of keys) {
        const data = await storage.get(key);
        if (data && data.posts) {
          allPosts.push(...data.posts);
        }
      }
    }
    
    // Sort posts by creation date (newest first)
    allPosts.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    // Remove duplicates
    const uniquePosts = [];
    const seenIds = new Set();
    
    for (const post of allPosts) {
      if (!seenIds.has(post.id)) {
        seenIds.add(post.id);
        uniquePosts.push(post);
      }
    }
    
    return success(res, { 
      posts: uniquePosts 
    }, {
      meta: {
        count: uniquePosts.length,
        keyword: keyword || 'all',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    serverError(res, error, { context: 'Failed to fetch posts' });
  }
};