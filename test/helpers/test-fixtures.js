/**
 * Test fixtures and sample data for Reddit Feed tests
 * Provides consistent test data across different test files
 */

/**
 * Sample Reddit post data
 */
const REDDIT_POSTS = {
  javascript: {
    id: 'js-post-1',
    title: 'JavaScript Tips and Tricks',
    author: 'jsdev123',
    permalink: '/r/javascript/comments/js-post-1/javascript_tips_and_tricks',
    selftext: 'Here are some useful JavaScript tips for beginners...',
    created_utc: 1704067200,
    score: 42,
    num_comments: 15,
    subreddit_name_prefixed: 'r/javascript'
  },
  
  react: {
    id: 'react-post-1', 
    title: 'React Hooks Best Practices',
    author: 'reactfan',
    permalink: '/r/reactjs/comments/react-post-1/react_hooks_best_practices',
    selftext: 'A comprehensive guide to using React hooks effectively...',
    created_utc: 1704067300,
    score: 28,
    num_comments: 8,
    subreddit_name_prefixed: 'r/reactjs'
  },

  nodejs: {
    id: 'node-post-1',
    title: 'Node.js Performance Optimization',
    author: 'nodemaster',
    permalink: '/r/node/comments/node-post-1/nodejs_performance_optimization',
    selftext: 'Learn how to optimize your Node.js applications...',
    created_utc: 1704067400,
    score: 35,
    num_comments: 12,
    subreddit_name_prefixed: 'r/node'
  }
};

/**
 * Sample keyword configurations
 */
const KEYWORDS = {
  simple: ['javascript', 'react', 'nodejs'],
  
  objects: [
    { keyword: 'javascript', context: 'programming' },
    { keyword: 'react', context: 'frontend framework' },
    { keyword: 'nodejs', context: 'backend runtime' }
  ],
  
  mixed: [
    'javascript',
    { keyword: 'react', context: 'frontend' },
    'nodejs'
  ],
  
  single: ['slack'],
  
  empty: []
};

/**
 * Sample stored post data structures
 */
const STORED_POSTS = {
  javascript_batch_1: {
    keyword: 'javascript',
    timestamp: 1704067200000,
    posts: [REDDIT_POSTS.javascript]
  },
  
  react_batch_1: {
    keyword: 'react', 
    timestamp: 1704067300000,
    posts: [REDDIT_POSTS.react]
  },
  
  mixed_batch: {
    keyword: 'javascript',
    timestamp: 1704067500000,
    posts: [REDDIT_POSTS.javascript, REDDIT_POSTS.react]
  },
  
  empty_batch: {
    keyword: 'python',
    timestamp: 1704067600000,
    posts: []
  }
};

/**
 * Sample Reddit API responses
 */
const REDDIT_RESPONSES = {
  single_post: {
    data: {
      children: [{ data: REDDIT_POSTS.javascript }]
    }
  },
  
  multiple_posts: {
    data: {
      children: [
        { data: REDDIT_POSTS.javascript },
        { data: REDDIT_POSTS.react },
        { data: REDDIT_POSTS.nodejs }
      ]
    }
  },
  
  empty: {
    data: {
      children: []
    }
  }
};

/**
 * Sample HTTP request/response objects
 */
const HTTP_MOCKS = {
  request: {
    get: {
      method: 'GET',
      headers: {},
      query: {}
    },
    
    post: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {}
    },
    
    delete: {
      method: 'DELETE',
      headers: {},
      query: {}
    }
  },
  
  response: {
    success: {
      status: jest.fn(() => ({ json: jest.fn() })),
      json: jest.fn()
    },
    
    error: {
      status: jest.fn(() => ({ json: jest.fn() })),
      json: jest.fn()
    }
  }
};

/**
 * Environment variable configurations for testing
 */
const ENV_CONFIGS = {
  local: {
    NODE_ENV: 'test'
  },
  
  vercel: {
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_REGION: 'us-east-1'
  },
  
  vercel_with_proxy: {
    NODE_ENV: 'production',
    VERCEL: '1',
    PROXY_USER: 'testuser',
    PROXY_PASS: 'testpass',
    PROXY_HOST: 'proxy.example.com:8080'
  },
  
  vercel_with_cron: {
    NODE_ENV: 'production',
    VERCEL: '1',
    CRON_SECRET: 'test-secret'
  },
  
  upstash_kv: {
    KV_REST_API_URL: 'https://api.upstash.com',
    KV_REST_API_TOKEN: 'test-token-123'
  },
  
  upstash_redis: {
    REDIS_URL: 'redis://default:token123@test.upstash.io:6379'
  }
};

/**
 * Common error messages and status codes
 */
const ERRORS = {
  method_not_allowed: {
    status: 405,
    message: 'Method not allowed'
  },
  
  missing_fields: {
    status: 400,
    message: 'Missing required fields'
  },
  
  keyword_exists: {
    status: 409,
    message: 'Keyword already exists'
  },
  
  keyword_not_found: {
    status: 404,
    message: 'Keyword not found'
  },
  
  unauthorized: {
    status: 401,
    message: 'Unauthorized'
  },
  
  server_error: {
    status: 500,
    message: 'Internal server error'
  },
  
  storage_error: {
    status: 500,
    message: 'Storage error'
  }
};

/**
 * Common URL patterns and API endpoints
 */
const URLS = {
  reddit: {
    search: 'https://www.reddit.com/search/.json',
    post_template: 'https://www.reddit.com/r/{subreddit}/comments/{id}'
  },
  
  api: {
    posts: '/api/posts',
    keywords: '/api/keywords', 
    fetch_reddit: '/api/fetch-reddit',
    cron_fetch: '/api/cron/fetch-posts'
  }
};

/**
 * Creates a Reddit post with customizable properties
 * @param {Object} overrides - Properties to override
 * @returns {Object} Reddit post data
 */
function createRedditPost(overrides = {}) {
  return {
    ...REDDIT_POSTS.javascript,
    ...overrides
  };
}

/**
 * Creates a stored posts batch with customizable properties
 * @param {Object} overrides - Properties to override
 * @returns {Object} Stored posts batch
 */
function createStoredPostsBatch(overrides = {}) {
  return {
    ...STORED_POSTS.javascript_batch_1,
    ...overrides
  };
}

/**
 * Creates a Reddit API response with customizable posts
 * @param {Array} posts - Array of post data
 * @returns {Object} Reddit API response
 */
function createRedditApiResponse(posts = []) {
  return {
    data: {
      children: posts.map(post => ({ data: post }))
    }
  };
}

/**
 * Creates a timestamp for testing (in milliseconds)
 * @param {number} offset - Offset in seconds from base time
 * @returns {number} Timestamp in milliseconds
 */
function createTimestamp(offset = 0) {
  return 1704067200000 + (offset * 1000);
}

/**
 * Creates storage keys for posts
 * @param {string} keyword - Keyword
 * @param {number} timestamp - Timestamp
 * @returns {string} Storage key
 */
function createPostKey(keyword, timestamp) {
  return `posts:${keyword}:${timestamp}`;
}

module.exports = {
  REDDIT_POSTS,
  KEYWORDS,
  STORED_POSTS,
  REDDIT_RESPONSES,
  HTTP_MOCKS,
  ENV_CONFIGS,
  ERRORS,
  URLS,
  createRedditPost,
  createStoredPostsBatch,
  createRedditApiResponse,
  createTimestamp,
  createPostKey
};