const appConfig = require('./config');

class Storage {
  constructor(options = {}) {
    // Initialize Upstash Redis client
    this.initializeUpstash();
  }

  initializeUpstash() {
    try {
      const { Redis } = require('@upstash/redis');
      
      // Check for credentials
      const hasKvCredentials = appConfig.storage.hasKvCredentials;
      const hasRedisUrl = appConfig.storage.hasRedisUrl;
      
      if (hasKvCredentials) {
        // Use Vercel KV (Upstash) with REST credentials
        console.log('Initializing Vercel KV/Upstash Redis');
        
        this.redis = new Redis({
          url: appConfig.storage.kvRestApiUrl,
          token: appConfig.storage.kvRestApiToken,
        });
      } else if (hasRedisUrl && appConfig.storage.effectiveRedisUrl) {
        // Use Upstash REST client with REDIS_URL or KV_URL
        // Parse the REDIS_URL to extract the REST URL and token
        // Upstash REDIS_URL format: redis://default:token@endpoint.upstash.io:port
        const redisUrl = appConfig.storage.effectiveRedisUrl;
        const url = new URL(redisUrl);
        const token = url.password;
        const restUrl = `https://${url.hostname}`;
        
        console.log('Initializing Upstash Redis with:', {
          hostname: url.hostname,
          hasToken: !!token,
          tokenLength: token ? token.length : 0
        });
        
        this.redis = new Redis({
          url: restUrl,
          token: token,
        });
      } else {
        throw new Error('No Upstash Redis credentials found. Set either KV_REST_API_URL/KV_REST_API_TOKEN or REDIS_URL/KV_URL');
      }
    } catch (e) {
      console.error('Upstash Redis initialization error:', e);
      throw new Error(`Failed to initialize Upstash Redis: ${e.message}`);
    }
  }

  async init() {
    // No initialization needed for Upstash
    return;
  }

  async get(key) {
    if (!this.redis) {
      throw new Error('Redis client not initialized');
    }
    // Upstash automatically handles JSON
    return await this.redis.get(key);
  }

  async set(key, value, options = {}) {
    if (!this.redis) {
      throw new Error('Redis client not initialized');
    }
    // Upstash handles JSON automatically
    await this.redis.set(key, value);
    return 'OK';
  }

  async delete(key) {
    if (!this.redis) {
      throw new Error('Redis client not initialized');
    }
    return await this.redis.del(key);
  }

  async sadd(key, member) {
    if (!this.redis) {
      throw new Error('Redis client not initialized');
    }
    return await this.redis.sadd(key, member);
  }

  async smembers(key) {
    if (!this.redis) {
      throw new Error('Redis client not initialized');
    }
    return await this.redis.smembers(key);
  }

  async sismember(key, member) {
    if (!this.redis) {
      throw new Error('Redis client not initialized');
    }
    return await this.redis.sismember(key, member);
  }

  async keys(pattern) {
    if (!this.redis) {
      throw new Error('Redis client not initialized');
    }
    return await this.redis.keys(pattern || '*');
  }
}

// Singleton instance
let storageInstance;

function getStorage(config) {
  if (!storageInstance) {
    storageInstance = new Storage(config);
  }
  return storageInstance;
}

// Reset function for testing
function resetStorage() {
  storageInstance = null;
}

module.exports = { Storage, getStorage, resetStorage };