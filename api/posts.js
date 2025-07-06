const { getStorage } = require('../lib/storage');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const storage = getStorage();
    await storage.init();
    
    const { keyword } = req.query;
    const allPosts = [];
    
    if (keyword) {
      // Get posts for specific keyword
      const keys = await storage.keys(`posts:${keyword}:*`);
      
      for (const key of keys) {
        const data = await storage.get(key);
        if (data && data.posts) {
          allPosts.push(...data.posts);
        }
      }
    } else {
      // Get all posts
      const keys = await storage.keys('posts:*');
      
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
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};