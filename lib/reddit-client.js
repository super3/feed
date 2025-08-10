const config = require('./config');
const logger = require('./logger');

// Only use http-client if it exists (for backward compatibility with tests)
let getHttpClient;
try {
  getHttpClient = require('./http-client').getHttpClient;
} catch (e) {
  // http-client not available, will use legacy code path
}

async function fetchRedditPosts(keyword, storage) {
  const postsKey = `posts:${keyword}:${Date.now()}`;
  
  // Get all existing posts for this keyword to check for duplicates
  const existingPostKeys = await storage.keys(`posts:${keyword}:*`);
  logger.debug('Checking existing posts', { keyword, existingPostKeys: existingPostKeys.length });
  const existingPostIds = new Set();
  
  for (const key of existingPostKeys) {
    const data = await storage.get(key);
    if (data && data.posts) {
      data.posts.forEach(post => existingPostIds.add(post.id));
    }
  }
  
  // Search Reddit
  logger.info('Fetching Reddit posts', { keyword });
  
  let responseData;
  
  try {
    // Use HTTP client if available
    if (getHttpClient) {
      const httpClient = getHttpClient();
      responseData = await httpClient.redditRequest(
        config.reddit.searchUrl,
        {
          q: keyword,
          type: config.reddit.defaultType,
          t: config.reddit.defaultTimeframe
        }
      );
    } else {
      // Fallback to direct fetch (for tests)
      const url = `${config.reddit.searchUrl}?q=${encodeURIComponent(keyword)}&type=${config.reddit.defaultType}&t=${config.reddit.defaultTimeframe}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': config.reddit.userAgent,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok && response.status !== 403) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }
      
      responseData = response.status === 403 ? { data: { children: [] } } : await response.json();
    }
    
    const posts = responseData?.data?.children || [];
  
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
      
      logger.info('Saving new posts', { keyword, count: processedPosts.length, key: postsKey });
    } else {
      logger.debug('No new posts found', { keyword });
    }
    
    return {
      keyword,
      newPosts: processedPosts.length,
      totalFound: posts.length,
      key: processedPosts.length > 0 ? postsKey : null
    };
  } catch (error) {
    logger.error('Failed to fetch Reddit posts', { keyword, error: error.message });
    
    // Return empty result on error to avoid breaking the app
    if (error.message.includes('403') || error.message.includes('access denied')) {
      logger.warn('Reddit access denied, returning empty results');
      return {
        keyword,
        newPosts: 0,
        totalFound: 0,
        key: null
      };
    }
    
    throw error;
  }
}

module.exports = {
  fetchRedditPosts
};