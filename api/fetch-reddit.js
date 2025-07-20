const { getStorage } = require('../lib/storage');
const { methodNotAllowed, serverError } = require('../lib/utils/error-handler');

const CONFIG = {
  searchUrl: 'https://www.reddit.com/search/.json',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

async function fetchRedditPosts(keyword, storage) {
  const postedIdsKey = `posted:${keyword}`;
  const postsKey = `posts:${keyword}:${Date.now()}`;
  
  // Load previously posted IDs
  const postedIds = new Set(await storage.smembers(postedIdsKey));
  
  // Search Reddit
  const url = `${CONFIG.searchUrl}?q=${encodeURIComponent(keyword)}&type=posts&t=hour`;
  
  console.log(`Fetching Reddit posts for keyword: ${keyword}`);
  console.log(`Request URL: ${url}`);
  
  const response = await fetch(url, {
    headers: { 'User-Agent': CONFIG.userAgent }
  });

  if (!response.ok) {
    console.error(`Reddit API error: ${response.status} ${response.statusText}`);
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
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