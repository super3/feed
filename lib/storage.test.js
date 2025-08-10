const fs = require('fs').promises;
const path = require('path');
const { getStorage, resetStorage } = require('./storage');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn()
  }
}));

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

describe('Storage - Local Implementation', () => {
  let storage;
  const testDataDir = path.join(__dirname, '..', 'data');

  beforeEach(() => {
    jest.clearAllMocks();
    resetStorage(); // Reset singleton
    storage = getStorage({ type: 'local' });
  });

  describe('init', () => {
    it('should create data directory', async () => {
      await storage.init();
      expect(fs.mkdir).toHaveBeenCalledWith(testDataDir, { recursive: true });
    });

    it('should handle directory creation errors gracefully', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));
      // Should not throw
      await expect(storage.init()).resolves.toBeUndefined();
    });
  });

  describe('get/set operations', () => {
    it('should write and read JSON data', async () => {
      const testData = { foo: 'bar', count: 42 };
      
      await storage.set('test-key', testData);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(testDataDir, 'test-key.json'),
        JSON.stringify(testData, null, 2)
      );
    });

    it('should return null for non-existent keys', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const result = await storage.get('missing-key');
      
      expect(result).toBeNull();
    });

    it('should parse JSON when reading', async () => {
      const testData = { foo: 'bar' };
      fs.readFile.mockResolvedValue(JSON.stringify(testData));
      
      const result = await storage.get('test-key');
      
      expect(result).toEqual(testData);
    });
  });

  describe('delete operation', () => {
    it('should delete existing file', async () => {
      await storage.delete('test-key');
      
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(testDataDir, 'test-key.json')
      );
    });

    it('should return 0 for non-existent file', async () => {
      fs.unlink.mockRejectedValue({ code: 'ENOENT' });
      
      const result = await storage.delete('missing-key');
      
      expect(result).toBe(0);
    });
  });

  describe('set operations', () => {
    it('should add member to set', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(['item1', 'item2']));
      
      const result = await storage.sadd('myset', 'item3');
      
      expect(result).toBe(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(['item1', 'item2', 'item3'], null, 2)
      );
    });

    it('should not add duplicate member', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(['item1', 'item2']));
      
      const result = await storage.sadd('myset', 'item1');
      
      expect(result).toBe(0);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should create new set if not exists', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const result = await storage.sadd('newset', 'item1');
      
      expect(result).toBe(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(['item1'], null, 2)
      );
    });
  });

  describe('keys operation', () => {
    it('should list all keys', async () => {
      fs.readdir.mockResolvedValue(['key1.json', 'key2.json', 'other.txt']);
      
      const keys = await storage.keys();
      
      expect(keys).toEqual(['key1', 'key2']);
    });

    it('should filter keys by pattern', async () => {
      fs.readdir.mockResolvedValue(['posts:js:1234.json', 'posts:py:5678.json', 'config:keywords.json']);
      
      const keys = await storage.keys('posts:*');
      
      expect(keys).toEqual(['posts:js:1234', 'posts:py:5678']);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported storage types', async () => {
      resetStorage();
      const unsupportedStorage = getStorage({ type: 'unsupported' });
      
      await expect(unsupportedStorage.get('test')).rejects.toThrow('Storage type unsupported not implemented');
      await expect(unsupportedStorage.set('test', 'value')).rejects.toThrow('Storage type unsupported not implemented');
      await expect(unsupportedStorage.delete('test')).rejects.toThrow('Storage type unsupported not implemented');
      await expect(unsupportedStorage.sadd('test', 'member')).rejects.toThrow('Storage type unsupported not implemented');
      await expect(unsupportedStorage.smembers('test')).rejects.toThrow('Storage type unsupported not implemented');
      await expect(unsupportedStorage.sismember('test', 'member')).rejects.toThrow('Storage type unsupported not implemented');
      await expect(unsupportedStorage.keys('*')).rejects.toThrow('Storage type unsupported not implemented');
    });

    it('should rethrow non-ENOENT errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));
      
      await expect(storage.get('test')).rejects.toThrow('Permission denied');
    });

    it('should rethrow non-ENOENT errors on delete', async () => {
      fs.unlink.mockRejectedValue(new Error('Permission denied'));
      
      await expect(storage.delete('test')).rejects.toThrow('Permission denied');
    });
  });

  describe('singleton behavior', () => {
    it('should return same instance', () => {
      const instance1 = getStorage();
      const instance2 = getStorage();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getStorage();
      resetStorage();
      const instance2 = getStorage();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('sismember operation', () => {
    it('should return 1 for existing member', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(['item1', 'item2']));
      
      const result = await storage.sismember('myset', 'item1');
      
      expect(result).toBe(1);
    });

    it('should return 0 for non-existing member', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(['item1', 'item2']));
      
      const result = await storage.sismember('myset', 'item3');
      
      expect(result).toBe(0);
    });
  });

  describe('smembers operation', () => {
    it('should return empty array for non-existent set', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      const result = await storage.smembers('nonexistent');
      
      expect(result).toEqual([]);
    });
  });
});

describe('Storage - Redis Implementation', () => {
  let storage;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStorage();
    
    // Set Redis environment variables to trigger Redis mode
    process.env.REDIS_URL = 'redis://default:test-token@test.upstash.io:6379';
    
    storage = getStorage();
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  describe('basic operations', () => {
    it('should use Redis for get operation', async () => {
      mockRedisInstance.get.mockResolvedValue({ test: 'data' });
      
      const result = await storage.get('test-key');
      
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ test: 'data' });
    });

    it('should use Redis for set operation', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      
      const result = await storage.set('test-key', { test: 'data' });
      
      expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', { test: 'data' });
      expect(result).toBe('OK');
    });

    it('should use Redis for delete operation', async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      
      const result = await storage.delete('test-key');
      
      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(1);
    });
  });

  describe('set operations', () => {
    it('should use Redis for sadd operation', async () => {
      mockRedisInstance.sadd.mockResolvedValue(1);
      
      const result = await storage.sadd('myset', 'item1');
      
      expect(mockRedisInstance.sadd).toHaveBeenCalledWith('myset', 'item1');
      expect(result).toBe(1);
    });

    it('should use Redis for smembers operation', async () => {
      mockRedisInstance.smembers.mockResolvedValue(['item1', 'item2']);
      
      const result = await storage.smembers('myset');
      
      expect(mockRedisInstance.smembers).toHaveBeenCalledWith('myset');
      expect(result).toEqual(['item1', 'item2']);
    });

    it('should use Redis for sismember operation', async () => {
      mockRedisInstance.sismember.mockResolvedValue(1);
      
      const result = await storage.sismember('myset', 'item1');
      
      expect(mockRedisInstance.sismember).toHaveBeenCalledWith('myset', 'item1');
      expect(result).toBe(1);
    });
  });

  describe('keys operation', () => {
    it('should use Redis for keys operation with pattern', async () => {
      mockRedisInstance.keys.mockResolvedValue(['posts:js:1234', 'posts:py:5678']);
      
      const result = await storage.keys('posts:*');
      
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('posts:*');
      expect(result).toEqual(['posts:js:1234', 'posts:py:5678']);
    });

    it('should use Redis for keys operation without pattern', async () => {
      mockRedisInstance.keys.mockResolvedValue(['key1', 'key2']);
      
      const result = await storage.keys();
      
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('*');
      expect(result).toEqual(['key1', 'key2']);
    });
  });
});

describe('Storage - Vercel environment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStorage();
    process.env.VERCEL = '1';
  });

  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.REDIS_URL;
  });

  it('should use local storage on Vercel without Upstash URL', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const storage = getStorage();
    expect(storage.type).toBe('local');
  });

  it('should use Redis on Vercel with REDIS_URL pointing to Upstash', () => {
    process.env.REDIS_URL = 'redis://default:token123@example.upstash.io:6379';
    const storage = getStorage();
    expect(storage.type).toBe('redis');
  });

  it('should use /tmp directory on Vercel for local storage', async () => {
    const storage = getStorage();
    expect(storage.type).toBe('local');
    
    await storage.init();
    
    expect(storage.dataDir).toBe('/tmp/feed-data');
    expect(fs.mkdir).toHaveBeenCalledWith('/tmp/feed-data', { recursive: true });
  });

  it('should fall back to local storage when Upstash Redis fails', async () => {
    // Clear module cache
    jest.resetModules();
    
    // Mock Redis module to throw error
    jest.doMock('@upstash/redis', () => {
      throw new Error('Redis module failed to load');
    });

    process.env.REDIS_URL = 'redis://test.upstash.io:6379';
    
    const { Storage } = require('./storage');
    const storage = new Storage();
    await storage.init();
    
    expect(storage.type).toBe('local');
    expect(storage.redis).toBeUndefined();
    
    // Cleanup
    delete process.env.REDIS_URL;
    jest.dontMock('@upstash/redis');
  });

  it('should handle standard Redis client with connection error', async () => {
    jest.resetModules();
    
    process.env.REDIS_URL = 'redis://regular-redis.com:6379';
    
    const mockRedisClient = {
      connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      sadd: jest.fn(),
      smembers: jest.fn(),
      del: jest.fn()
    };

    jest.doMock('redis', () => ({
      createClient: jest.fn(() => mockRedisClient)
    }));

    const { Storage } = require('./storage');
    const storage = new Storage();
    await storage.init();
    
    expect(storage.type).toBe('local');
    expect(mockRedisClient.connect).toHaveBeenCalled();
    
    // Cleanup
    delete process.env.REDIS_URL;
    jest.dontMock('redis');
  });

  it('should handle standard Redis operations', async () => {
    jest.resetModules();
    
    process.env.REDIS_URL = 'redis://regular-redis.com:6379';
    
    const mockRedisClient = {
      connect: jest.fn().mockResolvedValue(),
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      sadd: jest.fn(),
      smembers: jest.fn(),
      del: jest.fn()
    };

    jest.doMock('redis', () => ({
      createClient: jest.fn(() => mockRedisClient)
    }));

    const { Storage } = require('./storage');
    const storage = new Storage();
    await storage.init();
    
    expect(storage.type).toBe('redis');
    expect(storage.redisType).toBe('standard');

    // Test get with JSON parsing
    mockRedisClient.get.mockResolvedValue('{"test": "data"}');
    const result = await storage.get('testkey');
    expect(result).toEqual({ test: 'data' });

    // Test get with non-JSON string
    mockRedisClient.get.mockResolvedValue('plain string');
    const plainResult = await storage.get('plainkey');
    expect(plainResult).toBe('plain string');

    // Test get with null
    mockRedisClient.get.mockResolvedValue(null);
    const nullResult = await storage.get('nullkey');
    expect(nullResult).toBeNull();

    // Test set
    await storage.set('key', { data: 'value' });
    expect(mockRedisClient.set).toHaveBeenCalledWith('key', JSON.stringify({ data: 'value' }));

    // Test keys
    mockRedisClient.keys.mockResolvedValue(['key1', 'key2']);
    const keys = await storage.keys('pattern*');
    expect(keys).toEqual(['key1', 'key2']);

    // Test sadd
    mockRedisClient.sadd.mockResolvedValue(1);
    const saddResult = await storage.sadd('set', 'member');
    expect(saddResult).toBe(1);

    // Test smembers
    mockRedisClient.smembers.mockResolvedValue(['member1', 'member2']);
    const members = await storage.smembers('set');
    expect(members).toEqual(['member1', 'member2']);

    // Test del
    mockRedisClient.del.mockResolvedValue(1);
    const delResult = await storage.del('key');
    expect(delResult).toBe(1);
    
    // Cleanup
    delete process.env.REDIS_URL;
    jest.dontMock('redis');
  });

  it('should handle standard Redis client initialization error', async () => {
    jest.resetModules();
    
    process.env.REDIS_URL = 'redis://regular-redis.com:6379';
    
    // Mock redis module to throw error
    jest.doMock('redis', () => {
      throw new Error('Redis module not found');
    });

    const { Storage } = require('./storage');
    const storage = new Storage();
    await storage.init();
    
    expect(storage.type).toBe('local');
    expect(storage.redis).toBeUndefined();
    
    // Cleanup
    delete process.env.REDIS_URL;
    jest.dontMock('redis');
  });

  it('should handle errors in standard Redis operations', async () => {
    jest.resetModules();
    
    process.env.REDIS_URL = 'redis://regular-redis.com:6379';
    
    const mockRedisClient = {
      connect: jest.fn().mockResolvedValue(),
      get: jest.fn().mockRejectedValue(new Error('Get failed')),
      set: jest.fn().mockRejectedValue(new Error('Set failed')),
      keys: jest.fn().mockRejectedValue(new Error('Keys failed')),
      sadd: jest.fn().mockRejectedValue(new Error('Sadd failed')),
      smembers: jest.fn().mockRejectedValue(new Error('Smembers failed')),
      del: jest.fn().mockRejectedValue(new Error('Del failed'))
    };

    jest.doMock('redis', () => ({
      createClient: jest.fn(() => mockRedisClient)
    }));

    const { Storage } = require('./storage');
    const storage = new Storage();
    await storage.init();

    // Test error handling for each operation
    await expect(storage.get('key')).rejects.toThrow('Get failed');
    await expect(storage.set('key', 'value')).rejects.toThrow('Set failed');
    await expect(storage.keys('pattern')).rejects.toThrow('Keys failed');
    await expect(storage.sadd('set', 'member')).rejects.toThrow('Sadd failed');
    await expect(storage.smembers('set')).rejects.toThrow('Smembers failed');
    await expect(storage.del('key')).rejects.toThrow('Del failed');
    
    // Cleanup
    delete process.env.REDIS_URL;
    jest.dontMock('redis');
  });
});