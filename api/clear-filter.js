const { getStorage } = require('../lib/storage');
const { success, methodNotAllowed, badRequest, serverError, validation } = require('../lib/utils/error-handler');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const validationError = validation.validate(req.body, ['keyword', 'postIds'], { 
      keyword: 'string',
      postIds: 'array'
    });
    if (validationError) {
      return badRequest(res, validationError);
    }

    const { keyword, postIds } = req.body;

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

    return success(res, { 
      clearedCount,
      keyword
    }, {
      message: `Cleared filter data for ${clearedCount} posts`,
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    serverError(res, error, { context: 'Failed to clear filter' });
  }
};