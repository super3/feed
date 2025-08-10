const { getStorage, resetStorage } = require('./storage');

// Create mock Redis instance
const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  sadd: jest.fn(),
  smembers: jest.fn(),
  sismember: jest.fn(),
  keys: jest.fn()
};

// Mock @upstash/redis module
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => mockRedisInstance)
}));

describe('Storage - Upstash Implementation', () => {
  let storage;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStorage(); // Reset singleton
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should initialize with KV REST credentials', () => {
      process.env.KV_REST_API_URL = 'https://api.upstash.com';
      process.env.KV_REST_API_TOKEN = 'token123';
      
      const { Redis } = require('@upstash/redis');
      storage = getStorage();
      
      expect(Redis).toHaveBeenCalledWith({
        url: 'https://api.upstash.com',
        token: 'token123'
      });
    });

    it('should initialize with REDIS_URL', () => {
      process.env.REDIS_URL = 'redis://default:token123@test.upstash.io:6379';
      
      const { Redis } = require('@upstash/redis');
      storage = getStorage();
      
      expect(Redis).toHaveBeenCalledWith({
        url: 'https://test.upstash.io',
        token: 'token123'
      });
    });

    it('should initialize with KV_URL', () => {
      process.env.KV_URL = 'redis://default:kvtoken@kv.upstash.io:6379';
      
      const { Redis } = require('@upstash/redis');
      storage = getStorage();
      
      expect(Redis).toHaveBeenCalledWith({
        url: 'https://kv.upstash.io',
        token: 'kvtoken'
      });
    });

    it('should throw error when no credentials are provided', () => {
      delete process.env.KV_REST_API_URL;
      delete process.env.KV_REST_API_TOKEN;
      delete process.env.REDIS_URL;
      delete process.env.KV_URL;
      
      expect(() => {
        storage = getStorage();
      }).toThrow('No Upstash Redis credentials found');
    });

    it('should handle Redis module loading error', () => {
      process.env.KV_REST_API_URL = 'https://api.upstash.com';
      process.env.KV_REST_API_TOKEN = 'token123';
      
      // Mock Redis constructor to throw
      const { Redis } = require('@upstash/redis');
      Redis.mockImplementationOnce(() => {
        throw new Error('Module not found');
      });
      
      expect(() => {
        storage = getStorage();
      }).toThrow('Failed to initialize Upstash Redis');
    });
  });

  describe('operations', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'https://api.upstash.com';
      process.env.KV_REST_API_TOKEN = 'token123';
      storage = getStorage();
    });

    describe('get', () => {
      it('should get value from Redis', async () => {
        mockRedisInstance.get.mockResolvedValue({ foo: 'bar' });
        const result = await storage.get('test-key');
        expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
        expect(result).toEqual({ foo: 'bar' });
      });

      it('should return null for non-existent key', async () => {
        mockRedisInstance.get.mockResolvedValue(null);
        const result = await storage.get('non-existent');
        expect(result).toBeNull();
      });
    });

    describe('set', () => {
      it('should set value in Redis', async () => {
        mockRedisInstance.set.mockResolvedValue('OK');
        const result = await storage.set('test-key', { foo: 'bar' });
        expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', { foo: 'bar' });
        expect(result).toBe('OK');
      });

      it('should handle string values', async () => {
        mockRedisInstance.set.mockResolvedValue('OK');
        await storage.set('test-key', 'simple-string');
        expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', 'simple-string');
      });
    });

    describe('delete', () => {
      it('should delete key from Redis', async () => {
        mockRedisInstance.del.mockResolvedValue(1);
        const result = await storage.delete('test-key');
        expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
        expect(result).toBe(1);
      });

      it('should return 0 for non-existent key', async () => {
        mockRedisInstance.del.mockResolvedValue(0);
        const result = await storage.delete('non-existent');
        expect(result).toBe(0);
      });
    });

    describe('sadd', () => {
      it('should add member to set', async () => {
        mockRedisInstance.sadd.mockResolvedValue(1);
        const result = await storage.sadd('test-set', 'member1');
        expect(mockRedisInstance.sadd).toHaveBeenCalledWith('test-set', 'member1');
        expect(result).toBe(1);
      });

      it('should return 0 for duplicate member', async () => {
        mockRedisInstance.sadd.mockResolvedValue(0);
        const result = await storage.sadd('test-set', 'existing-member');
        expect(result).toBe(0);
      });
    });

    describe('smembers', () => {
      it('should get all members of set', async () => {
        mockRedisInstance.smembers.mockResolvedValue(['member1', 'member2']);
        const result = await storage.smembers('test-set');
        expect(mockRedisInstance.smembers).toHaveBeenCalledWith('test-set');
        expect(result).toEqual(['member1', 'member2']);
      });

      it('should return empty array for non-existent set', async () => {
        mockRedisInstance.smembers.mockResolvedValue([]);
        const result = await storage.smembers('non-existent');
        expect(result).toEqual([]);
      });
    });

    describe('sismember', () => {
      it('should check if member exists in set', async () => {
        mockRedisInstance.sismember.mockResolvedValue(1);
        const result = await storage.sismember('test-set', 'member1');
        expect(mockRedisInstance.sismember).toHaveBeenCalledWith('test-set', 'member1');
        expect(result).toBe(1);
      });

      it('should return 0 for non-member', async () => {
        mockRedisInstance.sismember.mockResolvedValue(0);
        const result = await storage.sismember('test-set', 'non-member');
        expect(result).toBe(0);
      });
    });

    describe('keys', () => {
      it('should get keys matching pattern', async () => {
        mockRedisInstance.keys.mockResolvedValue(['posts:keyword1:123', 'posts:keyword2:456']);
        const result = await storage.keys('posts:*');
        expect(mockRedisInstance.keys).toHaveBeenCalledWith('posts:*');
        expect(result).toEqual(['posts:keyword1:123', 'posts:keyword2:456']);
      });

      it('should get all keys when no pattern provided', async () => {
        mockRedisInstance.keys.mockResolvedValue(['key1', 'key2']);
        const result = await storage.keys();
        expect(mockRedisInstance.keys).toHaveBeenCalledWith('*');
        expect(result).toEqual(['key1', 'key2']);
      });
    });

    describe('init', () => {
      it('should do nothing for Upstash', async () => {
        await expect(storage.init()).resolves.toBeUndefined();
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'https://api.upstash.com';
      process.env.KV_REST_API_TOKEN = 'token123';
    });

    it('should throw error when Redis client is not initialized for get', async () => {
      storage = getStorage();
      storage.redis = null;
      await expect(storage.get('test')).rejects.toThrow('Redis client not initialized');
    });

    it('should throw error when Redis client is not initialized for set', async () => {
      storage = getStorage();
      storage.redis = null;
      await expect(storage.set('test', 'value')).rejects.toThrow('Redis client not initialized');
    });

    it('should throw error when Redis client is not initialized for delete', async () => {
      storage = getStorage();
      storage.redis = null;
      await expect(storage.delete('test')).rejects.toThrow('Redis client not initialized');
    });

    it('should throw error when Redis client is not initialized for sadd', async () => {
      storage = getStorage();
      storage.redis = null;
      await expect(storage.sadd('test', 'member')).rejects.toThrow('Redis client not initialized');
    });

    it('should throw error when Redis client is not initialized for smembers', async () => {
      storage = getStorage();
      storage.redis = null;
      await expect(storage.smembers('test')).rejects.toThrow('Redis client not initialized');
    });

    it('should throw error when Redis client is not initialized for sismember', async () => {
      storage = getStorage();
      storage.redis = null;
      await expect(storage.sismember('test', 'member')).rejects.toThrow('Redis client not initialized');
    });

    it('should throw error when Redis client is not initialized for keys', async () => {
      storage = getStorage();
      storage.redis = null;
      await expect(storage.keys('*')).rejects.toThrow('Redis client not initialized');
    });
  });

  describe('singleton behavior', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'https://api.upstash.com';
      process.env.KV_REST_API_TOKEN = 'token123';
    });

    it('should return same instance on multiple calls', () => {
      const storage1 = getStorage();
      const storage2 = getStorage();
      expect(storage1).toBe(storage2);
    });

    it('should create new instance after reset', () => {
      const storage1 = getStorage();
      resetStorage();
      const storage2 = getStorage();
      expect(storage1).not.toBe(storage2);
    });
  });
});