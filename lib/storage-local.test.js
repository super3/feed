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

describe('Storage - Local File Implementation', () => {
  let storage;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStorage();
    process.env = { ...originalEnv };
    // Ensure no Upstash credentials to force local storage
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.REDIS_URL;
    delete process.env.KV_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should use local storage when no Redis credentials are provided', () => {
      storage = getStorage();
      expect(storage.type).toBe('local');
    });

    it('should create data directory on init', async () => {
      storage = getStorage();
      await storage.init();
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true }
      );
    });

    it('should handle mkdir errors gracefully', async () => {
      fs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      
      storage = getStorage();
      await storage.init(); // Should not throw
      
      expect(fs.mkdir).toHaveBeenCalled();
    });
  });

  describe('get operation', () => {
    beforeEach(() => {
      storage = getStorage();
    });

    it('should read and parse JSON from file', async () => {
      const testData = { test: 'data', count: 42 };
      fs.readFile.mockResolvedValueOnce(JSON.stringify(testData));
      
      const result = await storage.get('test:key');
      
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test_key.json'),
        'utf8'
      );
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent file', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValueOnce(error);
      
      const result = await storage.get('missing:key');
      
      expect(result).toBeNull();
    });

    it('should throw error for other file read errors', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(storage.get('test:key')).rejects.toThrow('Permission denied');
    });
  });

  describe('set operation', () => {
    beforeEach(() => {
      storage = getStorage();
    });

    it('should write JSON to file', async () => {
      const testData = { test: 'data', nested: { value: true } };
      fs.writeFile.mockResolvedValueOnce();
      
      const result = await storage.set('test:key', testData);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test_key.json'),
        JSON.stringify(testData, null, 2)
      );
      expect(result).toBe('OK');
    });
  });

  describe('delete operation', () => {
    beforeEach(() => {
      storage = getStorage();
    });

    it('should delete file and return 1', async () => {
      fs.unlink.mockResolvedValueOnce();
      
      const result = await storage.delete('test:key');
      
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test_key.json')
      );
      expect(result).toBe(1);
    });

    it('should return 0 for non-existent file', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.unlink.mockRejectedValueOnce(error);
      
      const result = await storage.delete('missing:key');
      
      expect(result).toBe(0);
    });

    it('should throw error for other deletion errors', async () => {
      fs.unlink.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(storage.delete('test:key')).rejects.toThrow('Permission denied');
    });
  });

  describe('set operations (sadd, smembers, sismember)', () => {
    beforeEach(() => {
      storage = getStorage();
    });

    it('should add member to set', async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify(['existing']));
      fs.writeFile.mockResolvedValueOnce();
      
      const result = await storage.sadd('test:set', 'newmember');
      
      expect(result).toBe(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(['existing', 'newmember'], null, 2)
      );
    });

    it('should not add duplicate member to set', async () => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify(['existing']));
      
      const result = await storage.sadd('test:set', 'existing');
      
      expect(result).toBe(0);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should create new set if not exists', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValueOnce(error);
      fs.writeFile.mockResolvedValueOnce();
      
      const result = await storage.sadd('new:set', 'member');
      
      expect(result).toBe(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(['member'], null, 2)
      );
    });

    it('should get all members of set', async () => {
      const members = ['member1', 'member2', 'member3'];
      fs.readFile.mockResolvedValueOnce(JSON.stringify(members));
      
      const result = await storage.smembers('test:set');
      
      expect(result).toEqual(members);
    });

    it('should return empty array for non-existent set', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValueOnce(error);
      
      const result = await storage.smembers('missing:set');
      
      expect(result).toEqual([]);
    });

    it('should check if member exists in set', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(['member1', 'member2']))
        .mockResolvedValueOnce(JSON.stringify(['member1', 'member2']));
      
      const exists = await storage.sismember('test:set', 'member1');
      const notExists = await storage.sismember('test:set', 'member3');
      
      expect(exists).toBe(1);
      expect(notExists).toBe(0);
    });
  });

  describe('keys operation', () => {
    beforeEach(() => {
      storage = getStorage();
    });

    it('should list all keys when no pattern provided', async () => {
      fs.readdir.mockResolvedValueOnce(['posts_test_123.json', 'config_keywords.json', 'other.txt']);
      
      const result = await storage.keys();
      
      expect(result).toEqual(['posts:test:123', 'config:keywords']);
    });

    it('should filter keys by pattern', async () => {
      fs.readdir.mockResolvedValueOnce([
        'posts_javascript_123.json',
        'posts_python_456.json',
        'config_keywords.json'
      ]);
      
      const result = await storage.keys('posts:*');
      
      expect(result).toEqual(['posts:javascript:123', 'posts:python:456']);
    });

    it('should handle specific pattern matching', async () => {
      fs.readdir.mockResolvedValueOnce([
        'posts_javascript_123.json',
        'posts_javascript_456.json',
        'posts_python_789.json'
      ]);
      
      const result = await storage.keys('posts:javascript:*');
      
      expect(result).toEqual(['posts:javascript:123', 'posts:javascript:456']);
    });

    it('should return empty array when directory does not exist', async () => {
      const error = new Error('Directory not found');
      error.code = 'ENOENT';
      fs.readdir.mockRejectedValueOnce(error);
      
      const result = await storage.keys();
      
      expect(result).toEqual([]);
    });

    it('should throw error for other readdir errors', async () => {
      fs.readdir.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(storage.keys()).rejects.toThrow('Permission denied');
    });
  });
});