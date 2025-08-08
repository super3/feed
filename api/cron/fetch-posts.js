const { getStorage } = require('../../lib/storage');
const { methodNotAllowed, serverError } = require('../../lib/utils/error-handler');
const { HttpsProxyAgent } = require('https-proxy-agent');
const https = require('https');

const CONFIG = {
  searchUrl: 'https://www.reddit.com/search/.json',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function fetchRedditPosts(keyword, storage) {
  const postsKey = `posts:${keyword}:${Date.now()}`;
  
  // Get all existing posts for this keyword to check for duplicates
  const existingPostKeys = await storage.keys(`posts:${keyword}:*`);
  console.log(`Checking ${existingPostKeys.length} existing post keys for keyword: ${keyword}`);
  const existingPostIds = new Set();
  
  for (const key of existingPostKeys) {
    const data = await storage.get(key);
    if (data && data.posts) {
      data.posts.forEach(post => existingPostIds.add(post.id));
    }
  }
  
  // Search Reddit
  const searchPath = `/search/.json?q=${encodeURIComponent(keyword)}&type=posts&t=hour`;
  
  console.log(`Fetching Reddit posts for keyword: ${keyword}`);
  
  // Use proxy when proxy credentials are available
  let responseData;
  if (process.env.PROXY_USER && process.env.PROXY_PASS) {
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
          } else if (res.statusCode === 403) {
            console.error('Reddit blocked proxy request. Status:', res.statusCode);
            // Return empty data instead of failing completely
            resolve({ ok: true, data: { data: { children: [] } } });
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

  // Filter out already existing items
  for (const child of data.data.children) {
    const post = child.data;
    
    if (existingPostIds.has(post.id)) {
      continue; // Skip already existing post
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
  }

  // Save new posts
  if (newPosts.length > 0) {
    console.log(`Saving ${newPosts.length} new posts to key: ${postsKey}`);
    await storage.set(postsKey, {
      timestamp: new Date().toISOString(),
      count: newPosts.length,
      posts: newPosts
    });
  } else {
    console.log(`No new posts to save for keyword: ${keyword}`);
  }

  return newPosts;
}

module.exports = async (req, res) => {
  // Vercel Cron Jobs send a specific authorization header
  // You should verify this in production
  const authHeader = req.headers['authorization'];
  
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    console.log('Cron job triggered at:', new Date().toISOString());
    console.log('Authorization:', authHeader ? 'Present' : 'Not present');
    
    // Verify this is a legitimate cron request from Vercel
    if (process.env.VERCEL && process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    const storage = getStorage();
    console.log('Storage type:', storage.type);
    console.log('Redis type:', storage.redisType);
    
    await storage.init();
    
    // Get keywords from storage or use default
    const keywordsKey = 'config:keywords';
    let keywords = await storage.get(keywordsKey);
    console.log('Retrieved keywords from storage:', keywords);
    
    if (!keywords || keywords.length === 0) {
      console.log('No keywords found, setting default: slack');
      keywords = ['slack']; // Default keyword
      await storage.set(keywordsKey, keywords);
    }

    const results = {};
    let totalNewPosts = 0;
    
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
        totalNewPosts += posts.length;
      } catch (error) {
        console.error(`Error fetching posts for ${keyword}:`, error);
        results[keyword] = {
          success: false,
          error: error.message
        };
      }
    }

    console.log(`Cron job completed. Total new posts: ${totalNewPosts}`);

    res.status(200).json({
      timestamp: new Date().toISOString(),
      message: 'Cron job executed successfully',
      totalNewPosts: totalNewPosts,
      keywords: keywords,
      results: results
    });
  } catch (error) {
    console.error('Cron job error:', error);
    serverError(res, error, { context: 'Cron job failed' });
  }
};