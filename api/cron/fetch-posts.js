const { getStorage } = require('../../lib/storage');
const { success, methodNotAllowed, serverError, unauthorized } = require('../../lib/utils/error-handler');
const { fetchRedditPosts } = require('../../lib/reddit-client');
const config = require('../../lib/config');
const logger = require('../../lib/logger');

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  try {
    logger.info('Cron job triggered', { timestamp: new Date().toISOString() });
    logger.debug('Authorization header', { present: req.headers.authorization ? true : false });
    
    // Optional security check for cron jobs
    if (config.security.hasCronSecret) {
      const authHeader = req.headers.authorization;
      const providedSecret = authHeader?.replace('Bearer ', '');
      
      if (providedSecret !== config.security.cronSecret) {
        return unauthorized(res, 'Invalid cron secret');
      }
    }
    
    const storage = getStorage();
    logger.debug('Storage initialized', { type: storage.type, redisType: storage.redisType });
    
    await storage.init();
    
    // Get keywords from storage or use default
    const keywordsKey = config.keys.keywords;
    let keywords = await storage.get(keywordsKey);
    logger.debug('Retrieved keywords from storage', { keywords, count: keywords?.length || 0 });
    
    if (!keywords || keywords.length === 0) {
      logger.info('No keywords found, using default', { defaultKeyword: config.reddit.defaultKeyword });
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
        logger.error('Error fetching posts for keyword', { keyword, error: error.message, stack: error.stack });
        results[keyword] = {
          success: false,
          error: error.message
        };
      }
    }

    logger.info('Cron job completed', { totalNewPosts, keywords: keywords.length });

    return success(res, { 
      results: results 
    }, {
      message: 'Cron job completed successfully',
      meta: {
        timestamp: new Date().toISOString(),
        keywords: keywords,
        totalNewPosts: totalNewPosts,
        keywordCount: keywords.length
      }
    });
  } catch (error) {
    serverError(res, error, { context: 'Cron job failed' });
  }
};