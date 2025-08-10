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
              const parsed = JSON.parse(data);
              resolve({ ok: true, data: parsed });
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
    // Direct request without proxy (may fail due to Reddit blocking)
    const url = `${CONFIG.searchUrl}?q=${encodeURIComponent(keyword)}&type=posts&t=hour`;
    console.log(`Request URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok && response.status !== 403) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }
    
    responseData = {
      ok: response.ok || response.status === 403,
      data: response.status === 403 ? { data: { children: [] } } : await response.json()
    };
  }
  
  if (!responseData.ok) {
    throw new Error(`Failed to fetch Reddit posts: ${responseData.statusText || 'Unknown error'}`);
  }
  
  const posts = responseData.data?.data?.children || [];
  
  // Filter posts: only new posts (not in existing)
  const newPosts = posts.filter(post => {
    return !existingPostIds.has(post.data.id);
  });
  
  // Map posts to our format
  const processedPosts = newPosts.map(post => ({
    id: post.data.id,
    title: post.data.title,
    score: post.data.score,
    url: post.data.url,
    created: post.data.created_utc,
    subreddit: post.data.subreddit,
    num_comments: post.data.num_comments,
    permalink: `https://reddit.com${post.data.permalink}`
  }));
  
  // Save posts to storage if we have any new ones
  if (processedPosts.length > 0) {
    await storage.set(postsKey, {
      keyword,
      timestamp: Date.now(),
      posts: processedPosts
    });
    
    console.log(`Saving ${processedPosts.length} new posts to key: ${postsKey}`);
  } else {
    console.log(`No new posts to save for keyword: ${keyword}`);
  }
  
  return {
    keyword,
    newPosts: processedPosts.length,
    totalFound: posts.length,
    key: processedPosts.length > 0 ? postsKey : null
  };
}

module.exports = {
  fetchRedditPosts,
  CONFIG
};