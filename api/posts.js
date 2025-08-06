const { getStorage } = require('../lib/storage');
const { methodNotAllowed, serverError } = require('../lib/utils/error-handler');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const storage = getStorage();
    console.log('Posts API - Storage type:', storage.type, 'Redis type:', storage.redisType);
    await storage.init();
    
    const { keyword } = req.query;
    const allPosts = [];
    
    if (keyword) {
      // Get posts for specific keyword
      const keys = await storage.keys(`posts:${keyword}:*`);
      console.log(`Found ${keys.length} post keys for keyword: ${keyword}`);
      
      for (const key of keys) {
        const data = await storage.get(key);
        if (data && data.posts) {
          allPosts.push(...data.posts);
        }
      }
    } else {
      // Get all posts
      const keys = await storage.keys('posts:*');
      console.log(`Found ${keys.length} total post keys`);
      
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
    
    res.status(200).json({
      count: uniquePosts.length,
      keyword: keyword || 'all',
      posts: uniquePosts
    });
  } catch (error) {
    serverError(res, error, { context: 'Failed to fetch posts' });
  }
};