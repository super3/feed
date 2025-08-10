const { HttpClient, getHttpClient, resetHttpClient } = require('./http-client');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Mock dependencies
jest.mock('https-proxy-agent');
jest.mock('./config', () => ({
  environment: {
    isVercel: false
  },
  proxy: {
    hasAuth: false,
    url: 'http://user:pass@proxy.example.com:8080',
    host: 'proxy.example.com:8080'
  },
  reddit: {
    userAgent: 'TestAgent/1.0'
  }
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('HttpClient', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    resetHttpClient();
    global.fetch.mockReset();
  });

  describe('initialization', () => {
    it('should create client with default options', () => {
      client = new HttpClient();
      
      expect(client.defaultTimeout).toBe(30000);
      expect(client.maxRetries).toBe(3);
      expect(client.retryDelay).toBe(1000);
      expect(client.userAgent).toBe('TestAgent/1.0');
    });

    it('should create client with custom options', () => {
      client = new HttpClient({
        timeout: 60000,
        maxRetries: 5,
        retryDelay: 2000,
        userAgent: 'CustomAgent/2.0'
      });
      
      expect(client.defaultTimeout).toBe(60000);
      expect(client.maxRetries).toBe(5);
      expect(client.retryDelay).toBe(2000);
      expect(client.userAgent).toBe('CustomAgent/2.0');
    });
  });

  describe('proxy configuration', () => {
    it('should not use proxy when not on Vercel', () => {
      const config = require('./config');
      config.environment.isVercel = false;
      config.proxy.hasAuth = true;
      
      client = new HttpClient();
      const agent = client.getProxyAgent();
      
      expect(agent).toBeNull();
    });

    it('should use proxy when on Vercel with auth', () => {
      const config = require('./config');
      config.environment.isVercel = true;
      config.proxy.hasAuth = true;
      
      client = new HttpClient();
      const agent = client.getProxyAgent();
      
      expect(HttpsProxyAgent).toHaveBeenCalledWith('http://user:pass@proxy.example.com:8080');
      expect(agent).toBeDefined();
    });

    it('should not use proxy when auth is missing', () => {
      const config = require('./config');
      config.environment.isVercel = true;
      config.proxy.hasAuth = false;
      
      client = new HttpClient();
      const agent = client.getProxyAgent();
      
      expect(agent).toBeNull();
    });
  });

  describe('request with retry logic', () => {
    beforeEach(() => {
      client = new HttpClient({ maxRetries: 3, retryDelay: 100 });
    });

    it('should succeed on first attempt', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
        headers: new Map()
      };
      global.fetch.mockResolvedValueOnce(mockResponse);
      
      const result = await client.request('https://api.example.com/test');
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'test' });
    });

    it('should retry on failure and succeed', async () => {
      const mockError = new Error('Network error');
      const mockSuccess = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'success' }),
        headers: new Map()
      };
      
      global.fetch
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);
      
      const result = await client.request('https://api.example.com/test');
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should handle rate limiting with retry-after header', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: jest.fn().mockReturnValue('1') // 1 second retry-after
        }
      };
      const successResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'success' }),
        headers: new Map()
      };
      
      global.fetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);
      
      const result = await client.request('https://api.example.com/test');
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should fail after max retries', async () => {
      const mockError = new Error('Persistent error');
      global.fetch.mockRejectedValue(mockError);
      
      await expect(client.request('https://api.example.com/test'))
        .rejects.toThrow('HTTP request failed after 3 attempts: Persistent error');
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle non-rate-limit HTTP errors', async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map()
      };
      
      global.fetch.mockResolvedValue(errorResponse);
      
      await expect(client.request('https://api.example.com/test'))
        .rejects.toThrow('HTTP request failed after 3 attempts: HTTP 500: Internal Server Error');
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('fetchWithTimeout', () => {
    beforeEach(() => {
      client = new HttpClient();
    });

    it('should handle timeout', async () => {
      // Create an AbortController to simulate timeout
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      
      // Mock fetch to reject with abort error
      global.fetch.mockRejectedValueOnce(abortError);
      
      const promise = client.fetchWithTimeout('https://api.example.com/test', {
        timeout: 100
      });
      
      await expect(promise).rejects.toThrow('The operation was aborted');
    });

    it('should clear timeout on success', async () => {
      const mockResponse = { ok: true };
      global.fetch.mockResolvedValueOnce(mockResponse);
      
      const result = await client.fetchWithTimeout('https://api.example.com/test', {
        timeout: 1000
      });
      
      expect(result).toEqual(mockResponse);
    });
  });

  describe('redditRequest', () => {
    beforeEach(() => {
      client = new HttpClient();
    });

    it('should build URL with query parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: { children: [] } }),
        headers: new Map()
      };
      global.fetch.mockResolvedValueOnce(mockResponse);
      
      await client.redditRequest('https://reddit.com/search.json', {
        q: 'javascript',
        limit: 10,
        sort: 'new'
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://reddit.com/search.json?q=javascript&limit=10&sort=new',
        expect.any(Object)
      );
    });

    it('should handle Reddit API errors', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ error: 'Invalid token' }),
        headers: new Map()
      };
      global.fetch.mockResolvedValueOnce(mockResponse);
      
      await expect(client.redditRequest('https://reddit.com/api'))
        .rejects.toThrow('Reddit API error: Invalid token');
    });

    it('should provide specific error for 403', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Map()
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(client.redditRequest('https://reddit.com/api'))
        .rejects.toThrow('Reddit API access denied. Proxy may be required.');
    });

    it('should provide specific error for 429', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      await expect(client.redditRequest('https://reddit.com/api'))
        .rejects.toThrow('Reddit API rate limit exceeded. Please wait before retrying.');
    });

    it('should handle null/undefined parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
        headers: new Map()
      };
      global.fetch.mockResolvedValueOnce(mockResponse);
      
      await client.redditRequest('https://reddit.com/api', {
        q: 'test',
        limit: null,
        sort: undefined
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://reddit.com/api?q=test',
        expect.any(Object)
      );
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const client1 = getHttpClient();
      const client2 = getHttpClient();
      
      expect(client1).toBe(client2);
    });

    it('should create new instance after reset', () => {
      const client1 = getHttpClient();
      resetHttpClient();
      const client2 = getHttpClient();
      
      expect(client1).not.toBe(client2);
    });
  });

  describe('delay helper', () => {
    it('should delay for specified time', async () => {
      client = new HttpClient();
      const start = Date.now();
      
      await client.delay(100);
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
      expect(elapsed).toBeLessThan(200);
    });
  });
});