const { getStorage } = require('../lib/storage');
const { methodNotAllowed, serverError } = require('../lib/utils/error-handler');
const { HttpsProxyAgent } = require('https-proxy-agent');
const https = require('https');

const CONFIG = {
  searchUrl: 'https://www.reddit.com/search/.json',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function fetchRedditPosts(keyword, storage) {
  const postedIdsKey = `posted:${keyword}`;
  const postsKey = `posts:${keyword}:${Date.now()}`;
  
  // Load previously posted IDs
  const postedIds = new Set(await storage.smembers(postedIdsKey));
  
  // Search Reddit
  const searchPath = `/search/.json?q=${encodeURIComponent(keyword)}&type=posts&t=hour`;
  
  console.log(`Fetching Reddit posts for keyword: ${keyword}`);
  
  // Use proxy when running on Vercel with proxy credentials
  let responseData;
  if (process.env.VERCEL && process.env.PROXY_USER && process.env.PROXY_PASS) {
    const proxyHost = process.env.PROXY_HOST || '82.26.109.10:5712';
    const proxyUrl = `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${proxyHost}/`;
    console.log(`Using proxy: ${proxyHost}`);
    
    // Use https module with proxy agent since fetch doesn't properly support proxies
    responseData = await new Promise((resolve, reject) => {
      const agent = new HttpsProxyAgent(proxyUrl);
      const options = {
        hostname: 'www.reddit.com',
        port: 443,
        path: searchPath,
        method: 'GET',
        agent: agent,
        headers: {
          'User-Agent': CONFIG.userAgent,
          'Accept': 'application/json'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve({ ok: true, data: JSON.parse(data) });
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`Reddit API error: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  } else {
    // Use regular fetch when not using proxy
    const url = `${CONFIG.searchUrl}?q=${encodeURIComponent(keyword)}&type=posts&t=hour`;
    console.log(`Request URL: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': CONFIG.userAgent }
    });
    
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }
    
    responseData = { ok: true, data: await response.json() };
  }

  if (!responseData.ok) {
    throw responseData.error || new Error('Reddit API error');
  }

  const data = responseData.data;
  const newPosts = [];

  // Filter out already posted items
  for (const child of data.data.children) {
    const post = child.data;
    
    if (postedIds.has(post.id)) {
      continue; // Skip already posted
    }

    const postData = {
      id: post.id,
      title: post.title,
      author: post.author,
      url: `https://www.reddit.com${post.permalink}`,
      selftext: post.selftext || '',
      created_utc: post.created_utc,
      created: new Date(post.created_utc * 1000).toISOString(),
      score: post.score,
      num_comments: post.num_comments,
      subreddit: post.subreddit_name_prefixed,
      keyword: keyword
    };

    newPosts.push(postData);
    await storage.sadd(postedIdsKey, post.id);
  }

  // Save new posts
  if (newPosts.length > 0) {
    await storage.set(postsKey, {
      timestamp: new Date().toISOString(),
      count: newPosts.length,
      posts: newPosts
    });
  }

  return newPosts;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  try {
    console.log('Fetch Reddit API called');
    console.log('Environment:', {
      hasRedisUrl: !!process.env.REDIS_URL,
      nodeVersion: process.version,
      platform: process.platform
    });
    
    const storage = getStorage();
    console.log('Storage type:', storage.type);
    console.log('Redis type:', storage.redisType);
    
    await storage.init();
    
    // Get keywords from storage or use default
    const keywordsKey = 'config:keywords';
    let keywords = await storage.get(keywordsKey);
    
    if (!keywords || keywords.length === 0) {
      keywords = ['slack']; // Default keyword
      await storage.set(keywordsKey, keywords);
    }

    const results = {};
    
    // Fetch posts for each keyword
    for (const keywordItem of keywords) {
      // Handle both string and object formats
      const keyword = typeof keywordItem === 'string' ? keywordItem : keywordItem.keyword;
      
      try {
        const posts = await fetchRedditPosts(keyword, storage);
        results[keyword] = {
          success: true,
          count: posts.length,
          posts: posts
        };
      } catch (error) {
        console.error(`Error fetching posts for ${keyword}:`, error);
        results[keyword] = {
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
      }
    }

    res.status(200).json({
      timestamp: new Date().toISOString(),
      keywords: keywords,
      results: results
    });
  } catch (error) {
    serverError(res, error, { context: 'Failed to fetch Reddit posts' });
  }
};