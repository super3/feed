const { getStorage } = require('../lib/storage');
const { methodNotAllowed, serverError } = require('../lib/utils/error-handler');
const { fetchRedditPosts } = require('../lib/reddit-client');
const config = require('../lib/config');

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  try {
    console.log('Fetch Reddit API called');
    console.log('Environment:', {
      hasRedisUrl: config.storage.hasRedisUrl,
      nodeVersion: process.version,
      platform: process.platform
    });
    
    const storage = getStorage();
    console.log('Storage type:', storage.type);
    console.log('Redis type:', storage.redisType);
    
    await storage.init();
    
    // Get keywords from storage or use default
    const keywordsKey = config.keys.keywords;
    let keywords = await storage.get(keywordsKey);
    console.log('Retrieved keywords from storage:', keywords);
    
    if (!keywords || keywords.length === 0) {
      console.log(`No keywords found, setting default: ${config.reddit.defaultKeyword}`);
      keywords = [config.reddit.defaultKeyword]; // Default keyword
      await storage.set(keywordsKey, keywords);
    }

    const results = {};
    let totalNewPosts = 0;
    
    // Fetch posts for each keyword
    for (const keywordItem of keywords) {
      // Handle both string and object formats
      const keyword = typeof keywordItem === 'string' ? keywordItem : keywordItem.keyword;
      
      try {
        const result = await fetchRedditPosts(keyword, storage);
        results[keyword] = {
          success: true,
          newPosts: result.newPosts,
          totalFound: result.totalFound,
          key: result.key
        };
        totalNewPosts += result.newPosts;
      } catch (error) {
        console.error(`Error fetching posts for ${keyword}:`, error);
        results[keyword] = {
          success: false,
          error: error.message,
          stack: config.environment.isDevelopment ? error.stack : undefined
        };
      }
    }

    res.status(200).json({
      timestamp: new Date().toISOString(),
      keywords: keywords,
      totalNewPosts: totalNewPosts,
      results: results
    });
  } catch (error) {
    serverError(res, error, { context: 'Failed to fetch Reddit posts' });
  }
};