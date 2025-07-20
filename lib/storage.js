const fs = require('fs').promises;
const path = require('path');

class Storage {
  constructor(config = {}) {
    // Auto-detect storage type based on environment
    const hasUpstashCredentials = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
    const hasRedisUrl = process.env.REDIS_URL;
    
    this.type = config.type || (hasUpstashCredentials || hasRedisUrl ? 'redis' : 'local');
    this.dataDir = config.dataDir || path.join(__dirname, '..', 'data');
    
    // Initialize Redis client if needed
    if (this.type === 'redis' && !this.redis) {
      try {
        if (hasUpstashCredentials) {
          // Use Upstash REST client
          const { Redis } = require('@upstash/redis');
          this.redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          });
          this.redisType = 'upstash';
        } else if (hasRedisUrl) {
          // Use standard Redis client
          const { createClient } = require('redis');
          this.redis = createClient({ url: process.env.REDIS_URL });
          this.redisType = 'standard';
          // Connect to Redis
          this.redis.connect().catch(err => {
            console.error('Redis connection error:', err);
            this.type = 'local'; // Fall back to local storage
          });
        }
      } catch (e) {
        // Redis client not available or credentials missing
        console.error('Redis initialization error:', e);
        this.type = 'local'; // Fall back to local storage
      }
    }
  }

  async init() {
    if (this.type === 'local') {
      try {
        await fs.mkdir(this.dataDir, { recursive: true });
      } catch (error) {
        console.error('Error creating data directory:', error);
      }
    }
  }

  async get(key) {
    if (this.type === 'local') {
      try {
        const filePath = path.join(this.dataDir, `${key}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    }
    
    if (this.type === 'redis' && this.redis) {
      if (this.redisType === 'standard') {
        const value = await this.redis.get(key);
        // Standard Redis returns strings, parse JSON if needed
        try {
          return value ? JSON.parse(value) : null;
        } catch {
          return value; // Return as-is if not JSON
        }
      } else {
        // Upstash automatically handles JSON
        return await this.redis.get(key);
      }
    }
    
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async set(key, value, options = {}) {
    if (this.type === 'local') {
      const filePath = path.join(this.dataDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(value, null, 2));
      return 'OK';
    }
    
    if (this.type === 'redis' && this.redis) {
      if (this.redisType === 'standard') {
        // Standard Redis needs JSON.stringify for objects
        const valueToStore = typeof value === 'object' ? JSON.stringify(value) : value;
        await this.redis.set(key, valueToStore);
        return 'OK';
      } else {
        // Upstash handles JSON automatically
        await this.redis.set(key, value);
        return 'OK';
      }
    }
    
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async delete(key) {
    if (this.type === 'local') {
      try {
        const filePath = path.join(this.dataDir, `${key}.json`);
        await fs.unlink(filePath);
        return 1;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return 0;
        }
        throw error;
      }
    }
    
    if (this.type === 'redis' && this.redis) {
      return await this.redis.del(key);
    }
    
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async sadd(key, member) {
    if (this.type === 'local') {
      const set = (await this.get(key)) || [];
      if (!set.includes(member)) {
        set.push(member);
        await this.set(key, set);
        return 1;
      }
      return 0;
    }
    
    if (this.type === 'redis' && this.redis) {
      if (this.redisType === 'standard') {
        // Standard Redis sadd returns number of elements added
        return await this.redis.sAdd(key, member);
      } else {
        return await this.redis.sadd(key, member);
      }
    }
    
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async smembers(key) {
    if (this.type === 'local') {
      return (await this.get(key)) || [];
    }
    
    if (this.type === 'redis' && this.redis) {
      if (this.redisType === 'standard') {
        // Standard Redis uses sMembers
        return await this.redis.sMembers(key);
      } else {
        return await this.redis.smembers(key);
      }
    }
    
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async sismember(key, member) {
    if (this.type === 'local') {
      const set = (await this.get(key)) || [];
      return set.includes(member) ? 1 : 0;
    }
    
    if (this.type === 'redis' && this.redis) {
      if (this.redisType === 'standard') {
        // Standard Redis uses sIsMember
        return await this.redis.sIsMember(key, member) ? 1 : 0;
      } else {
        return await this.redis.sismember(key, member);
      }
    }
    
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async keys(pattern) {
    if (this.type === 'local') {
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const keys = jsonFiles.map(f => f.replace('.json', ''));
      
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return keys.filter(key => regex.test(key));
      }
      
      return keys;
    }
    
    if (this.type === 'redis' && this.redis) {
      if (this.redisType === 'standard') {
        // Standard Redis keys method
        return await this.redis.keys(pattern || '*');
      } else {
        return await this.redis.keys(pattern || '*');
      }
    }
    
    throw new Error(`Storage type ${this.type} not implemented`);
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

module.exports = { getStorage, resetStorage };