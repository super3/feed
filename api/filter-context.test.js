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

    it('should handle timeout errors', async () => {
      // Mock fetch that will be aborted
      let abortSignal;
      global.fetch.mockImplementation((url, options) => {
        abortSignal = options.signal;
        return new Promise((resolve, reject) => {
          // Simulate the abort happening
          setTimeout(() => {
            reject(new Error('AbortError'));
          }, 10);
        });
      });

      // Override setTimeout to immediately trigger timeout
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return 1;
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'test',
          context: 'testing',
          posts: [{ title: 'Test post', selftext: 'Content' }]
        }
      });

      // Mock the fetch error to have the right name
      global.fetch.mockRejectedValue(Object.assign(new Error('Request aborted'), { name: 'AbortError' }));

      await filterContextHandler(req, res);

      global.setTimeout = originalSetTimeout;

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results[0].relevant).toBe(false);
      expect(data.results[0].reasoning).toContain('Request timed out');
    });

    it('should handle JSON parsing errors', async () => {
      // Mock LM Studio returning invalid JSON
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'test',
          context: 'testing',
          posts: [{ title: 'Test post', selftext: 'Content' }]
        }
      });

      await filterContextHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results[0].relevant).toBe(false);
      expect(data.results[0].reasoning).toContain('Invalid response from LM Studio');
    });

    it('should handle various response formats', async () => {
      // Test "Answer: YES" pattern
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Based on analysis, Answer: YES' } }]
        })
      });

      // Test standalone YES on new line
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Some thinking...\nYES\n' } }]
        })
      });

      // Test last YES/NO in response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'I cannot say yes to this. NO' } }]
        })
      });

      // Test ambiguous response (no YES/NO) - ends with period
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This is unclear.' } }]
        })
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'test',
          context: 'testing',
          posts: [
            { title: 'Post 1', selftext: 'Content 1' },
            { title: 'Post 2', selftext: 'Content 2' },
            { title: 'Post 3', selftext: 'Content 3' },
            { title: 'Post 4', selftext: 'Content 4' }
          ]
        }
      });

      await filterContextHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      
      // Answer: YES pattern
      expect(data.results[0].relevant).toBe(true);
      
      // Standalone YES
      expect(data.results[1].relevant).toBe(true);
      
      // Last NO in response
      expect(data.results[2].relevant).toBe(false);
      
      // Ambiguous response (no YES/NO)
      expect(data.results[3].relevant).toBe(false);
    });

    it('should handle non-connection errors during processing', async () => {
      // Mock a generic error (not connection refused)
      global.fetch.mockRejectedValue(new Error('Generic error'));

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'test',
          context: 'testing',
          posts: [{ title: 'Test post', selftext: 'Content' }]
        }
      });

      await filterContextHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results[0].relevant).toBe(false);
      expect(data.results[0].reasoning).toContain('Could not analyze');
    });

    it('should handle empty response from LM Studio', async () => {
      // Mock empty response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'test',
          context: 'testing',
          posts: [{ title: 'Test post', selftext: 'Content' }]
        }
      });

      await filterContextHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results[0].relevant).toBe(false);
    });

    it('should process posts in batches', async () => {
      // Set batch size to 2 via environment variable
      process.env.LM_STUDIO_BATCH_SIZE = '2';

      // Mock responses for 3 posts (will be processed in 2 batches)
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'YES' } }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'NO' } }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'YES' } }] })
        });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          keyword: 'test',
          context: 'testing',
          posts: [
            { title: 'Post 1', selftext: 'Content 1' },
            { title: 'Post 2', selftext: 'Content 2' },
            { title: 'Post 3', selftext: 'Content 3' }
          ]
        }
      });

      await filterContextHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results).toHaveLength(3);
      expect(data.results[0].relevant).toBe(true);
      expect(data.results[1].relevant).toBe(false);
      expect(data.results[2].relevant).toBe(true);

      delete process.env.LM_STUDIO_BATCH_SIZE;
    });
  });
});