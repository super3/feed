const { getStorage } = require('../lib/storage');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { keyword, postIds } = req.body;

    if (!keyword || !postIds || !Array.isArray(postIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const storage = getStorage();
    await storage.init();
    
    // Get all post files for this keyword
    const keys = await storage.keys(`posts:${keyword}:*`);
    let clearedCount = 0;
    
    // Process each post file
    for (const key of keys) {
      const data = await storage.get(key);
      if (!data || !data.posts) continue;
      
      let modified = false;
      
      // Clear filter info from matching posts
      for (let i = 0; i < data.posts.length; i++) {
        const post = data.posts[i];
        
        if (postIds.includes(post.id) && (post.filterContext || post.isRelevant !== undefined)) {
          // Remove filter-related fields
          delete post.filterContext;
          delete post.isRelevant;
          delete post.filterReason;
          delete post.filteredAt;
          
          modified = true;
          clearedCount++;
        }
      }
      
      // Save the file if any posts were modified
      if (modified) {
        await storage.set(key, data);
      }
    }

    res.status(200).json({ 
      clearedCount,
      keyword
    });
  } catch (error) {
    console.error('Clear filter error:', error);
    res.status(500).json({ error: error.message });
  }
};