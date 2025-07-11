const filterContextHandler = require('./filter-context');
const { createMocks } = require('node-mocks-http');

// Mock fetch globally
global.fetch = jest.fn();

// Mock AbortController if not available in test environment
if (!global.AbortController) {
  global.AbortController = class {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}

// Mock console to suppress error logs in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

describe('/api/filter-context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });

  describe('Request validation', () => {
    it('should reject non-POST methods', async () => {
      const { req, res } = createMocks({ method: 'GET' });
      await filterContextHandler(req, res);
      
      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Method not allowed' });
    });

    it('should handle OPTIONS for CORS', async () => {
      const { req, res } = createMocks({ method: 'OPTIONS' });
      await filterContextHandler(req, res);
      
      expect(res._getStatusCode()).toBe(200);
    });

    it('should validate required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { keyword: 'test' } // Missing context and posts
      });
      
      await filterContextHandler(req, res);
      
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Missing required fields' });
    });
  });

  describe('LM Studio integration', () => {
    it('should filter posts using LM Studio', async () => {
      // Mock successful LM Studio response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'YES' } }]
        })
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'NO' } }]
        })
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'slack',
          context: 'the productivity tool',
          posts: [
            { title: 'Slack is down', selftext: 'The messaging app is having issues' },
            { title: 'Cut me some slack', selftext: 'I need a break' }
          ]
        }
      });

      await filterContextHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results).toHaveLength(2);
      expect(data.results[0]).toEqual({ index: 0, relevant: true, reasoning: 'YES' });
      expect(data.results[1]).toEqual({ index: 1, relevant: false, reasoning: 'NO' });
    });

    it('should handle LM Studio errors gracefully', async () => {
      // Mock LM Studio error
      global.fetch.mockRejectedValue(new Error('Connection refused'));

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'test',
          context: 'testing',
          posts: [{ title: 'Test post', selftext: 'Content' }]
        }
      });

      await filterContextHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Failed to filter posts');
      expect(data.hint).toContain('LM Studio');
      expect(data.model).toBeDefined();
    });

    it('should default to hiding posts when LM Studio fails', async () => {
      // Mock LM Studio returning non-OK status
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'test',
          context: 'testing',
          posts: [
            { title: 'Post 1', selftext: '' },
            { title: 'Post 2', selftext: '' }
          ]
        }
      });

      await filterContextHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      // Should default to hiding posts (not relevant) on error
      expect(data.results.every(r => r.relevant)).toBe(false);
    });
  });
});