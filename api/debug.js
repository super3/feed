const { getStorage } = require('../lib/storage');
const { success, methodNotAllowed, serverError } = require('../lib/utils/error-handler');
const { HttpsProxyAgent } = require('https-proxy-agent');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  try {
    const storage = getStorage();
    
    // Test Reddit API
    let redditTest = { success: false };
    try {
      let testUrl = 'https://www.reddit.com/search/.json?q=test&type=posts&t=hour';
      const isVercel = !!process.env.VERCEL;
      const hasProxyAuth = !!(process.env.PROXY_USER && process.env.PROXY_PASS);
      
      let fetchOptions = {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
      
      let proxyType = 'none';
      
      // Use proxy on Vercel
      if (isVercel && hasProxyAuth) {
        const proxyHost = process.env.PROXY_HOST || '82.26.109.10:5712';
        const proxyUrl = `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${proxyHost}/`;
        const agent = new HttpsProxyAgent(proxyUrl);
        fetchOptions.agent = agent;
        proxyType = `http-proxy (${proxyHost})`;
      }
      
      const response = await fetch(testUrl, fetchOptions);
      redditTest = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        proxyType: proxyType,
        hasProxyAuth: hasProxyAuth
      };
    } catch (error) {
      redditTest = {
        success: false,
        error: error.message,
        proxyType: process.env.VERCEL && process.env.PROXY_USER ? 'http-proxy' : 'none'
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
    
    return success(res, {
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        hasRedisUrl: !!process.env.REDIS_URL,
        hasUpstashCreds: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
        hasProxyCredentials: !!(process.env.PROXY_USER && process.env.PROXY_PASS),
        proxyHost: process.env.PROXY_HOST || '82.26.109.10:5712',
        vercelRegion: process.env.VERCEL_REGION || 'unknown'
      },
      storage: storageTest,
      reddit: redditTest
    }, {
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    return serverError(res, error, { 
      context: 'Debug endpoint error',
      details: { endpoint: 'debug' }
    });
  }
};