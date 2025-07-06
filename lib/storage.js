const fs = require('fs').promises;
const path = require('path');

class Storage {
  constructor(config = {}) {
    this.type = config.type || 'local';
    this.dataDir = config.dataDir || path.join(__dirname, '..', 'data');
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
    // TODO: Add Vercel KV implementation
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async set(key, value, options = {}) {
    if (this.type === 'local') {
      const filePath = path.join(this.dataDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(value, null, 2));
      return 'OK';
    }
    // TODO: Add Vercel KV implementation
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
    // TODO: Add Vercel KV implementation
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
    // TODO: Add Vercel KV implementation
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async smembers(key) {
    if (this.type === 'local') {
      return (await this.get(key)) || [];
    }
    // TODO: Add Vercel KV implementation
    throw new Error(`Storage type ${this.type} not implemented`);
  }

  async sismember(key, member) {
    if (this.type === 'local') {
      const set = (await this.get(key)) || [];
      return set.includes(member) ? 1 : 0;
    }
    // TODO: Add Vercel KV implementation
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
    // TODO: Add Vercel KV implementation
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

module.exports = { getStorage };