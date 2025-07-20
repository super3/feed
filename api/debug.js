const { getStorage } = require('../lib/storage');
const { methodNotAllowed } = require('../lib/utils/error-handler');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  try {
    const storage = getStorage();
    
    // Test Reddit API
    let redditTest = { success: false };
    try {
      const testUrl = 'https://www.reddit.com/search/.json?q=test&type=posts&t=hour';
      const response = await fetch(testUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      redditTest = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      redditTest = {
        success: false,
        error: error.message
      };
    }
    
    // Test storage
    let storageTest = { success: false };
    try {
      await storage.set('debug:test', { timestamp: Date.now() });
      const value = await storage.get('debug:test');
      await storage.delete('debug:test');
      storageTest = {
        success: true,
        type: storage.type,
        redisType: storage.redisType || 'N/A',
        value: value
      };
    } catch (error) {
      storageTest = {
        success: false,
        type: storage.type,
        error: error.message
      };
    }
    
    res.status(200).json({
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        hasRedisUrl: !!process.env.REDIS_URL,
        hasUpstashCreds: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
        vercelRegion: process.env.VERCEL_REGION || 'unknown'
      },
      storage: storageTest,
      reddit: redditTest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};