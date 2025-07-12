const httpMocks = require('node-mocks-http');
const keywordsHandler = require('./keywords');
const { getStorage } = require('../lib/storage');

// Mock storage
jest.mock('../lib/storage', () => ({
  getStorage: jest.fn()
}));

describe('/api/keywords', () => {
  let mockStorage;
  let req, res;

  beforeEach(() => {
    mockStorage = {
      init: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn()
    };
    getStorage.mockReturnValue(mockStorage);
  });

  describe('GET', () => {
    beforeEach(() => {
      req = httpMocks.createRequest({ method: 'GET' });
      res = httpMocks.createResponse();
    });

    it('should return existing keywords', async () => {
      mockStorage.get.mockResolvedValue(['javascript', 'react', 'nodejs']);

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toEqual({
        keywords: ['javascript', 'react', 'nodejs']
      });
    });

    it('should return empty array if no keywords', async () => {
      mockStorage.get.mockResolvedValue(null);

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toEqual({ keywords: [] });
    });
  });

  describe('POST', () => {
    beforeEach(() => {
      req = httpMocks.createRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      res = httpMocks.createResponse();
    });

    it('should add new keyword', async () => {
      req.body = { keyword: 'TypeScript' };
      mockStorage.get.mockResolvedValue(['javascript']);

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(201);
      expect(mockStorage.set).toHaveBeenCalledWith(
        'config:keywords',
        ['javascript', 'typescript']
      );
      const data = JSON.parse(res._getData());
      expect(data.keywords).toContain('typescript');
    });

    it('should reject duplicate keyword', async () => {
      req.body = { keyword: 'javascript' };
      mockStorage.get.mockResolvedValue(['javascript', 'react']);

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(409);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Keyword already exists');
    });

    it('should reject invalid keyword', async () => {
      req.body = { keyword: 123 };

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Invalid keyword');
    });
  });

  describe('DELETE', () => {
    beforeEach(() => {
      req = httpMocks.createRequest({ method: 'DELETE' });
      res = httpMocks.createResponse();
    });

    it('should delete existing keyword from query', async () => {
      req.query = { keyword: 'react' };
      mockStorage.get.mockResolvedValue(['javascript', 'react', 'nodejs']);

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockStorage.set).toHaveBeenCalledWith(
        'config:keywords',
        ['javascript', 'nodejs']
      );
    });

    it('should delete existing keyword from body', async () => {
      req.body = { keyword: 'react' };
      mockStorage.get.mockResolvedValue(['javascript', 'react']);

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockStorage.set).toHaveBeenCalledWith(
        'config:keywords',
        ['javascript']
      );
    });

    it('should return 404 for non-existent keyword', async () => {
      req.query = { keyword: 'python' };
      mockStorage.get.mockResolvedValue(['javascript', 'react']);

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Keyword not found');
    });

    it('should return 400 when no keyword parameter provided', async () => {
      req.query = {};
      req.body = {};

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Keyword parameter required');
    });
  });

  describe('Unsupported methods', () => {
    it('should return 405 for PUT', async () => {
      req = httpMocks.createRequest({ method: 'PUT' });
      res = httpMocks.createResponse();

      await keywordsHandler(req, res);

      expect(res.statusCode).toBe(405);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('Error handling', () => {
    it('should handle storage errors', async () => {
      req = httpMocks.createRequest({ method: 'GET' });
      res = httpMocks.createResponse();
      
      // Mock storage to throw an error
      mockStorage.init.mockRejectedValue(new Error('Storage error'));

      // Mock console.error to verify it's called
      const originalConsoleError = console.error;
      console.error = jest.fn();

      await keywordsHandler(req, res);

      expect(console.error).toHaveBeenCalledWith('Error:', expect.any(Error));
      expect(res.statusCode).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Storage error');

      console.error = originalConsoleError;
    });
  });
});