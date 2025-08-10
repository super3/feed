const fs = require('fs').promises;
const path = require('path');
const appConfig = require('./config');
const logger = require('./logger');

class Storage {
  constructor(options = {}) {
    // Check for Upstash credentials
    const hasKvCredentials = appConfig.storage.hasKvCredentials;
    const hasRedisUrl = appConfig.storage.hasRedisUrl;
    const isUpstashUrl = appConfig.storage.isUpstashUrl;
    
    // Determine storage type
    if (hasKvCredentials || (hasRedisUrl && isUpstashUrl)) {
      this.type = 'upstash';
      this.initializeUpstash();
    } else {
      // Fallback to local storage for development
      this.type = 'local';
      this.dataDir = options.dataDir || appConfig.paths.dataDir;
      logger.info('Using local file storage for development', { dataDir: this.dataDir });
    }
  }

  initializeUpstash() {
    try {
      const { Redis } = require('@upstash/redis');
      
      const hasKvCredentials = appConfig.storage.hasKvCredentials;
      const hasRedisUrl = appConfig.storage.hasRedisUrl;
      
      if (hasKvCredentials) {
        // Use Vercel KV (Upstash) with REST credentials
        logger.info('Initializing Vercel KV/Upstash Redis');
        
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
        
        logger.info('Initializing Upstash Redis', {
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
      logger.error('Upstash Redis initialization error', { error: e.message });
      throw new Error(`Failed to initialize Upstash Redis: ${e.message}`);
    }
  }

  async init() {
    if (this.type === 'local') {
      // Ensure data directory exists for local storage
      try {
        await fs.mkdir(this.dataDir, { recursive: true });
      } catch (error) {
        logger.error('Failed to create data directory', { error: error.message, dataDir: this.dataDir });
      }
    }
    // No initialization needed for Upstash
  }

  async get(key) {
    if (this.type === 'upstash') {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      // Upstash automatically handles JSON
      return await this.redis.get(key);
    } else {
      // Local file storage
      try {
        const filePath = path.join(this.dataDir, `${key.replace(/:/g, '_')}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    }
  }

  async set(key, value, options = {}) {
    if (this.type === 'upstash') {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      // Upstash handles JSON automatically
      await this.redis.set(key, value);
      return 'OK';
    } else {
      // Local file storage
      const filePath = path.join(this.dataDir, `${key.replace(/:/g, '_')}.json`);
      await fs.writeFile(filePath, JSON.stringify(value, null, 2));
      return 'OK';
    }
  }

  async delete(key) {
    if (this.type === 'upstash') {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      return await this.redis.del(key);
    } else {
      // Local file storage
      try {
        const filePath = path.join(this.dataDir, `${key.replace(/:/g, '_')}.json`);
        await fs.unlink(filePath);
        return 1;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return 0;
        }
        throw error;
      }
    }
  }

  async sadd(key, member) {
    if (this.type === 'upstash') {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      return await this.redis.sadd(key, member);
    } else {
      // Local file storage - simulate set behavior
      const set = await this.get(key) || [];
      if (!set.includes(member)) {
        set.push(member);
        await this.set(key, set);
        return 1;
      }
      return 0;
    }
  }

  async smembers(key) {
    if (this.type === 'upstash') {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      return await this.redis.smembers(key);
    } else {
      // Local file storage
      const set = await this.get(key) || [];
      return set;
    }
  }

  async sismember(key, member) {
    if (this.type === 'upstash') {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      return await this.redis.sismember(key, member);
    } else {
      // Local file storage
      const set = await this.get(key) || [];
      return set.includes(member) ? 1 : 0;
    }
  }

  async keys(pattern) {
    if (this.type === 'upstash') {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      return await this.redis.keys(pattern || '*');
    } else {
      // Local file storage
      try {
        const files = await fs.readdir(this.dataDir);
        const keys = files
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', '').replace(/_/g, ':'));
        
        if (pattern && pattern !== '*') {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return keys.filter(k => regex.test(k));
        }
        return keys;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return [];
        }
        throw error;
      }
    }
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