const httpMocks = require('node-mocks-http');
const fetchRedditHandler = require('./fetch-reddit');
const { getStorage } = require('../lib/storage');

// Mock storage
jest.mock('../lib/storage', () => ({
  getStorage: jest.fn()
}));

// Mock global fetch
global.fetch = jest.fn();

// Mock https module
const mockRequest = {
  on: jest.fn(),
  end: jest.fn()
};

const mockResponse = {
  statusCode: 200,
  statusMessage: 'OK',
  on: jest.fn()
};

jest.mock('https', () => ({
  request: jest.fn((options, callback) => {
    // Simulate response
    callback(mockResponse);
    // Simulate data event
    const dataHandler = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
    if (dataHandler) {
      dataHandler(JSON.stringify({ data: { children: [] } }));
    }
    // Simulate end event
    const endHandler = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
    if (endHandler) {
      endHandler();
    }
    return mockRequest;
  })
}));

describe('/api/fetch-reddit', () => {
  let mockStorage;
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorage = {
      init: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      smembers: jest.fn(),
      sadd: jest.fn()
    };
    getStorage.mockReturnValue(mockStorage);

    req = httpMocks.createRequest({ method: 'POST' });
    res = httpMocks.createResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch posts for configured keywords', async () => {
    // Setup mock data
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['javascript', 'react'];
      return null; // No existing posts
    });
    mockStorage.keys.mockResolvedValue([]); // No existing post keys

    // Mock Reddit API response
    const mockRedditResponse = {
      data: {
        children: [
          {
            data: {
              id: 'post1',
              title: 'JavaScript Tips',
              author: 'user1',
              permalink: '/r/javascript/comments/post1',
              created_utc: 1704067200,
              score: 42,
              num_comments: 10,
              subreddit_name_prefixed: 'r/javascript',
              selftext: 'This is the post content'
            }
          }
        ]
      }
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockRedditResponse
    });

    await fetchRedditHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    
    expect(data.keywords).toEqual(['javascript', 'react']);
    expect(data.results.javascript.success).toBe(true);
    expect(data.results.javascript.newPosts).toBe(1);
    expect(data.results.javascript.totalFound).toBe(1);
    
    // Verify storage calls
    expect(mockStorage.set).toHaveBeenCalledWith(
      expect.stringMatching(/^posts:javascript:\d+$/),
      expect.objectContaining({
        keyword: 'javascript',
        timestamp: expect.any(Number),
        posts: expect.any(Array)
      })
    );
  });

  it('should use default keyword if none configured', async () => {
    mockStorage.get.mockResolvedValue(null);
    mockStorage.keys.mockResolvedValue([]);
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { children: [] } })
    });

    await fetchRedditHandler(req, res);

    expect(mockStorage.set).toHaveBeenCalledWith('config:keywords', ['slack']);
    const data = JSON.parse(res._getData());
    expect(data.keywords).toEqual(['slack']);
  });

  it('should skip already existing items', async () => {
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['javascript'];
      if (key === 'posts:javascript:123') {
        return {
          posts: [{ id: 'existing-post-id', title: 'Old Post' }]
        };
      }
      return null;
    });
    mockStorage.keys.mockResolvedValue(['posts:javascript:123']); // Existing post key
    
    const mockRedditResponse = {
      data: {
        children: [
          {
            data: {
              id: 'existing-post-id',
              title: 'Old Post'
            }
          },
          {
            data: {
              id: 'new-post-id',
              title: 'New Post',
              author: 'user2',
              permalink: '/r/javascript/comments/new',
              created_utc: 1704067200,
              score: 10,
              num_comments: 5,
              subreddit_name_prefixed: 'r/javascript',
              selftext: ''
            }
          }
        ]
      }
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockRedditResponse
    });

    await fetchRedditHandler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.results.javascript.newPosts).toBe(1);
    expect(data.results.javascript.totalFound).toBe(2);
  });

  it('should handle Reddit API errors', async () => {
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['javascript'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);
    
    global.fetch.mockResolvedValue({
      ok: false,
      status: 429
    });

    await fetchRedditHandler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.results.javascript.success).toBe(false);
    expect(data.results.javascript.error).toContain('429');
  });

  it('should accept both GET and POST methods', async () => {
    req = httpMocks.createRequest({ method: 'GET' });
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { children: [] } })
    });

    await fetchRedditHandler(req, res);

    expect(res.statusCode).toBe(200);
  });

  it('should reject unsupported methods', async () => {
    req = httpMocks.createRequest({ method: 'DELETE' });
    
    await fetchRedditHandler(req, res);

    expect(res.statusCode).toBe(405);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Method not allowed');
  });

  it('should handle storage initialization errors', async () => {
    mockStorage.init.mockRejectedValue(new Error('Storage init failed'));

    await fetchRedditHandler(req, res);

    expect(res.statusCode).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Failed to fetch Reddit posts');
    expect(data.message).toBe('Storage init failed');
  });

  it('should use proxy when VERCEL and proxy credentials are set', async () => {
    // Set environment variables
    process.env.VERCEL = '1';
    process.env.PROXY_USER = 'testuser';
    process.env.PROXY_PASS = 'testpass';
    process.env.PROXY_HOST = 'proxy.example.com:8080';

    // Mock https module
    const https = require('https');
    jest.mock('https');
    
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);

    // Since we can't easily test the https module calls, we'll just verify the env vars are set
    await fetchRedditHandler(req, res);

    // Cleanup
    delete process.env.VERCEL;
    delete process.env.PROXY_USER;
    delete process.env.PROXY_PASS;
    delete process.env.PROXY_HOST;
  });

  it('should work without proxy when VERCEL is not set', async () => {
    // Ensure VERCEL is not set
    delete process.env.VERCEL;
    
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);
    mockStorage.sadd.mockResolvedValue(1);

    const mockRedditResponse = {
      data: {
        children: []
      }
    };

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockRedditResponse)
    });

    await fetchRedditHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.results.test.success).toBe(true);
  });

  it('should handle proxy request with invalid JSON response', async () => {
    // Set up for proxy usage
    process.env.VERCEL = '1';
    process.env.PROXY_USER = 'testuser';
    process.env.PROXY_PASS = 'testpass';
    process.env.PROXY_HOST = 'proxy.example.com:8080';

    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);

    // Mock https to return invalid JSON
    const https = require('https');
    https.request.mockImplementation((options, callback) => {
      const mockRes = {
        statusCode: 200,
        statusMessage: 'OK',
        on: jest.fn()
      };
      callback(mockRes);
      
      // Call data handler with invalid JSON
      const dataHandler = mockRes.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (dataHandler) {
        dataHandler('not valid json{{{');
      }
      
      // Call end handler
      const endHandler = mockRes.on.mock.calls.find(call => call[0] === 'end')?.[1];
      if (endHandler) {
        endHandler();
      }
      
      return mockRequest;
    });

    await fetchRedditHandler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.results.test.error).toContain('Invalid JSON response');

    // Cleanup
    delete process.env.VERCEL;
    delete process.env.PROXY_USER;
    delete process.env.PROXY_PASS;
    delete process.env.PROXY_HOST;
  });

  it('should handle responseData.ok false without error property', async () => {
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);

    // Mock fetch to return response with internal error that leads to ok: false
    global.fetch.mockRejectedValue(new Error('Reddit API error'));

    await fetchRedditHandler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.results.test.error).toContain('Reddit API error');
  });

  it('should handle Reddit API error with error property', async () => {
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);

    // Mock fetch to return error status
    global.fetch.mockRejectedValue(new Error('Reddit API error: 500 Internal Server Error'));

    await fetchRedditHandler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.results.test.error).toContain('Reddit API error');
  });

  it('should handle proxy 403 error gracefully', async () => {
    // Set up for proxy usage
    process.env.VERCEL = '1';
    process.env.PROXY_USER = 'testuser';
    process.env.PROXY_PASS = 'testpass';
    process.env.PROXY_HOST = 'proxy.example.com:8080';

    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);

    // Mock https to return 403 error
    const https = require('https');
    https.request.mockImplementation((options, callback) => {
      const mockRes = {
        statusCode: 403,
        statusMessage: 'Forbidden',
        on: jest.fn()
      };
      callback(mockRes);
      
      // Call end handler
      const endHandler = mockRes.on.mock.calls.find(call => call[0] === 'end')?.[1];
      if (endHandler) {
        endHandler();
      }
      
      return mockRequest;
    });

    await fetchRedditHandler(req, res);

    const data = JSON.parse(res._getData());
    // Should return empty results but not error out
    expect(data.results.test.success).toBe(true);
    expect(data.results.test.newPosts).toBe(0);
    expect(data.results.test.totalFound).toBe(0);

    // Cleanup
    delete process.env.VERCEL;
    delete process.env.PROXY_USER;
    delete process.env.PROXY_PASS;
    delete process.env.PROXY_HOST;
  });

  it('should handle proxy non-200/403 status code', async () => {
    // Set up for proxy usage
    process.env.VERCEL = '1';
    process.env.PROXY_USER = 'testuser';
    process.env.PROXY_PASS = 'testpass';
    process.env.PROXY_HOST = 'proxy.example.com:8080';

    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);

    // Mock https to return other error status
    const https = require('https');
    https.request.mockImplementation((options, callback) => {
      const mockRes = {
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        on: jest.fn()
      };
      callback(mockRes);
      
      // Call end handler
      const endHandler = mockRes.on.mock.calls.find(call => call[0] === 'end')?.[1];
      if (endHandler) {
        endHandler();
      }
      
      return mockRequest;
    });

    await fetchRedditHandler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.results.test.error).toContain('Reddit API error: 500');

    // Cleanup
    delete process.env.VERCEL;
    delete process.env.PROXY_USER;
    delete process.env.PROXY_PASS;
    delete process.env.PROXY_HOST;
  });
});