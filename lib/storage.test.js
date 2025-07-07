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
    it('should throw error for non-implemented storage types', async () => {
      resetStorage();
      const kvStorage = getStorage({ type: 'kv' });
      
      await expect(kvStorage.get('test')).rejects.toThrow('Storage type kv not implemented');
      await expect(kvStorage.set('test', 'value')).rejects.toThrow('Storage type kv not implemented');
      await expect(kvStorage.delete('test')).rejects.toThrow('Storage type kv not implemented');
      await expect(kvStorage.sadd('test', 'member')).rejects.toThrow('Storage type kv not implemented');
      await expect(kvStorage.smembers('test')).rejects.toThrow('Storage type kv not implemented');
      await expect(kvStorage.sismember('test', 'member')).rejects.toThrow('Storage type kv not implemented');
      await expect(kvStorage.keys('*')).rejects.toThrow('Storage type kv not implemented');
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