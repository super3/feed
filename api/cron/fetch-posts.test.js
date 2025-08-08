// Create mocks before requiring the handler
const mockStorage = {
  type: 'local',
  redisType: undefined,
  init: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  keys: jest.fn(() => []),
};

// Mock the storage module to always return the same instance
jest.mock('../../lib/storage', () => ({
  getStorage: jest.fn(() => mockStorage)
}));

// Mock https module for proxy requests
jest.mock('https', () => ({
  request: jest.fn((options, callback) => {
    const mockRes = {
      statusCode: 200,
      on: jest.fn((event, handler) => {
        if (event === 'data') {
          handler(JSON.stringify({
            data: {
              children: []
            }
          }));
        } else if (event === 'end') {
          handler();
        }
      })
    };
    callback(mockRes);
    return {
      on: jest.fn(),
      end: jest.fn()
    };
  })
}));

// Mock HttpsProxyAgent
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn()
}));

const handler = require('./fetch-posts');

describe('Cron Fetch Posts API', () => {
  let req, res;
  let originalEnv;
  
  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  beforeEach(() => {
    req = {
      method: 'GET',
      headers: {}
    };
    res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset mock storage
    mockStorage.init.mockClear();
    mockStorage.get.mockClear();
    mockStorage.set.mockClear();
    mockStorage.keys.mockClear();
    mockStorage.keys.mockReturnValue([]);
    
    // Reset all mock implementations to defaults
    mockStorage.init.mockResolvedValue(undefined);
    mockStorage.get.mockResolvedValue(null);
    mockStorage.set.mockResolvedValue('OK');
    
    // Reset environment variables
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL;
    delete process.env.PROXY_USER;
    delete process.env.PROXY_PASS;
    delete process.env.PROXY_HOST;
    
    // Reset https mock
    const https = require('https');
    https.request.mockClear();
    https.request.mockImplementation((options, callback) => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({
              data: {
                children: []
              }
            }));
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockRes);
      return {
        on: jest.fn(),
        end: jest.fn()
      };
    });
  });

  afterEach(() => {
    // Extra cleanup
    jest.clearAllMocks();
  });

  it('should execute cron job successfully with default keyword', async () => {
    // No keywords in storage, should use default
    mockStorage.get.mockResolvedValue(null);
    
    // Mock fetch for default keyword
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: { children: [] }
        })
      })
    );
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Cron job executed successfully',
        totalNewPosts: 0,
        keywords: ['slack']
      })
    );
    
    // Should save default keyword
    expect(mockStorage.set).toHaveBeenCalledWith('config:keywords', ['slack']);
  });

  it('should execute cron job with existing keywords', async () => {
    // Mock existing keywords - need to handle multiple get calls
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve(['javascript', 'react']);
      }
      return Promise.resolve(null);
    });
    
    // Mock fetch response
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            children: [
              {
                data: {
                  id: 'test1',
                  title: 'Test Post',
                  author: 'testuser',
                  permalink: '/r/test/comments/test1',
                  selftext: 'Test content',
                  created_utc: 1234567890,
                  score: 100,
                  num_comments: 10,
                  subreddit_name_prefixed: 'r/test'
                }
              }
            ]
          }
        })
      })
    );
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Cron job executed successfully',
        keywords: ['javascript', 'react']
      })
    );
  });

  it('should handle object format keywords', async () => {
    // Mock keywords in object format
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve([{ keyword: 'javascript', context: 'programming' }]);
      }
      return Promise.resolve(null);
    });
    
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: { children: [] }
        })
      })
    );
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Cron job executed successfully',
        totalNewPosts: 0
      })
    );
  });

  it('should validate cron secret in production', async () => {
    process.env.VERCEL = 'true';
    process.env.CRON_SECRET = 'test-secret';
    
    // Request without authorization
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('should accept valid cron secret', async () => {
    process.env.VERCEL = 'true';
    process.env.CRON_SECRET = 'test-secret';
    
    req.headers.authorization = 'Bearer test-secret';
    
    mockStorage.get.mockResolvedValue(['test']);
    
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: { children: [] }
        })
      })
    );
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle fetch errors gracefully', async () => {
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve(['test']);
      }
      return Promise.resolve(null);
    });
    
    global.fetch = jest.fn(() => 
      Promise.reject(new Error('Network error'))
    );
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Cron job executed successfully',
        totalNewPosts: 0,
        results: {
          test: {
            success: false,
            error: 'Network error'
          }
        }
      })
    );
  });

  it('should reject non-GET requests', async () => {
    req.method = 'POST';
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('should handle storage initialization errors', async () => {
    mockStorage.init.mockRejectedValue(new Error('Storage init failed'));
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should use proxy when credentials are available', async () => {
    process.env.PROXY_USER = 'user';
    process.env.PROXY_PASS = 'pass';
    process.env.PROXY_HOST = 'proxy.example.com:8080';
    
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve(['test']);
      }
      return Promise.resolve(null);
    });
    
    // The https mock is already set up in beforeEach
    await handler(req, res);
    
    // Verify that the handler succeeded (proxy was used)
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Cron job executed successfully'
      })
    );
    
    // The https.request mock should have been called when proxy is used
    const https = require('https');
    expect(https.request).toHaveBeenCalled();
  });

  it('should handle Reddit API 403 errors from proxy', async () => {
    process.env.PROXY_USER = 'user';
    process.env.PROXY_PASS = 'pass';
    process.env.PROXY_HOST = 'proxy.example.com:8080';
    
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve(['test']);
      }
      return Promise.resolve(null);
    });
    
    // Mock 403 response from proxy
    const https = require('https');
    https.request.mockClear();
    https.request.mockImplementation((options, callback) => {
      const mockRes = {
        statusCode: 403,
        statusMessage: 'Forbidden',
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('');
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockRes);
      return {
        on: jest.fn(),
        end: jest.fn()
      };
    });
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Cron job executed successfully',
        totalNewPosts: 0
      })
    );
  });

  it('should filter duplicate posts', async () => {
    // Mock existing posts
    mockStorage.keys.mockResolvedValue(['posts:test:123']);
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve(['test']);
      }
      if (key === 'posts:test:123') {
        return Promise.resolve({
          posts: [{ id: 'existing1' }]
        });
      }
      return Promise.resolve(null);
    });
    
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            children: [
              { data: { id: 'existing1', title: 'Existing' } },
              { data: { 
                id: 'new1', 
                title: 'New Post',
                author: 'user',
                permalink: '/r/test/new1',
                created_utc: 1234567890,
                score: 10,
                num_comments: 5,
                subreddit_name_prefixed: 'r/test'
              }}
            ]
          }
        })
      })
    );
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        totalNewPosts: 1
      })
    );
  });
});