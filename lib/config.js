/**
 * Centralized configuration module for all environment variables
 */

// Storage configuration - dynamic for testing
const storage = {
  // Redis/Upstash URLs - read dynamically
  get redisUrl() {
    return process.env.REDIS_URL;
  },
  
  get kvUrl() {
    return process.env.KV_URL;
  },
  
  // Vercel KV REST API credentials
  get kvRestApiUrl() {
    return process.env.KV_REST_API_URL;
  },
  
  get kvRestApiToken() {
    return process.env.KV_REST_API_TOKEN;
  },
  
  // Upstash specific config (deprecated, but kept for compatibility)
  get upstashRedisRestUrl() {
    return process.env.UPSTASH_REDIS_REST_URL;
  },
  
  get upstashRedisRestToken() {
    return process.env.UPSTASH_REDIS_REST_TOKEN;
  },
  
  // Helper methods
  get hasRedisUrl() {
    return !!(this.redisUrl || this.kvUrl);
  },
  
  get hasKvCredentials() {
    return !!(this.kvRestApiUrl && this.kvRestApiToken);
  },
  
  get isUpstashUrl() {
    return (this.hasRedisUrl && (
      this.redisUrl?.includes('.upstash.io') || 
      this.kvUrl?.includes('.upstash.io')
    )) || this.hasKvCredentials;
  },
  
  get effectiveRedisUrl() {
    return this.redisUrl || this.kvUrl;
  }
};

// Proxy configuration for Reddit API - dynamic for testing
const proxy = {
  get user() {
    return process.env.PROXY_USER;
  },
  
  get pass() {
    return process.env.PROXY_PASS;
  },
  
  get host() {
    return process.env.PROXY_HOST || '82.26.109.10:5712';
  },
  
  // Helper methods
  get hasCredentials() {
    return !!(this.user && this.pass);
  },
  
  get url() {
    if (!this.hasCredentials) return null;
    return `http://${this.user}:${this.pass}@${this.host}/`;
  }
};

// Deployment environment - dynamic for testing
const environment = {
  // Vercel deployment flag - read dynamically
  get isVercel() {
    return !!process.env.VERCEL;
  },
  
  get vercelRegion() {
    return process.env.VERCEL_REGION || 'unknown';
  },
  
  // Node environment
  get nodeEnv() {
    return process.env.NODE_ENV || 'production';
  },
  
  // Server port
  get port() {
    return process.env.PORT || 3000;
  },
  
  // Helper methods
  get isDevelopment() {
    return this.nodeEnv === 'development';
  },
  
  get isProduction() {
    return this.nodeEnv === 'production';
  },
  
  get isTest() {
    return this.nodeEnv === 'test';
  }
};

// Security configuration
const security = {
  // Cron job security token - read dynamically for testing
  get cronSecret() {
    return process.env.CRON_SECRET;
  },
  
  // Helper methods
  get hasCronSecret() {
    return !!this.cronSecret;
  }
};

// LLM/AI configuration (for filter context features) - dynamic for testing
const ai = {
  get lmStudioModel() {
    return process.env.LM_STUDIO_MODEL || 'deepseek/deepseek-r1-0528-qwen3-8b';
  },
  
  get lmStudioUrl() {
    return process.env.LM_STUDIO_URL || 'http://localhost:1234';
  },
  
  get lmStudioTimeout() {
    return parseInt(process.env.LM_STUDIO_TIMEOUT || '60000', 10);
  },
  
  // Helper methods
  get hasLmStudio() {
    return !!this.lmStudioUrl;
  }
};

// Reddit API configuration
const reddit = {
  searchUrl: 'https://www.reddit.com/search/.json',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Default search parameters
  defaultTimeframe: 'hour',
  defaultType: 'posts',
  
  // Default keyword if none configured
  defaultKeyword: 'slack'
};

// Storage paths configuration
const paths = {
  // Data directory for local storage
  get dataDir() {
    if (environment.isVercel) {
      return '/tmp/feed-data';
    }
    return require('path').join(__dirname, '..', 'data');
  }
};

// Keywords configuration key
const keys = {
  keywords: 'config:keywords'
};

// Export the configuration object
module.exports = {
  storage,
  proxy,
  environment,
  security,
  ai,
  reddit,
  paths,
  keys,
  
  // Convenience method to get all config at once
  getAll() {
    return {
      storage: this.storage,
      proxy: this.proxy,
      environment: this.environment,
      security: this.security,
      ai: this.ai,
      reddit: this.reddit,
      paths: this.paths,
      keys: this.keys
    };
  }
};