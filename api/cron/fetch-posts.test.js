const handler = require('./fetch-posts');

// Mock the storage module
jest.mock('../../lib/storage', () => ({
  getStorage: jest.fn(() => ({
    type: 'local',
    redisType: undefined,
    init: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    keys: jest.fn(() => []),
  }))
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

describe('Cron Fetch Posts API', () => {
  let req, res;
  
  beforeEach(() => {
    req = {
      method: 'GET',
      headers: {}
    };
    res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    
    // Clear mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL;
    delete process.env.PROXY_USER;
    delete process.env.PROXY_PASS;
  });

  it('should execute cron job successfully with default keyword', async () => {
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    
    // No keywords in storage, should use default
    mockStorage.get.mockResolvedValueOnce(null);
    
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
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    
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
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    
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
    
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    mockStorage.get.mockResolvedValueOnce(['test']);
    
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
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    
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
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    
    mockStorage.init.mockRejectedValue(new Error('Storage init failed'));
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should use proxy when credentials are available', async () => {
    process.env.PROXY_USER = 'user';
    process.env.PROXY_PASS = 'pass';
    
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve(['test']);
      }
      return Promise.resolve(null);
    });
    
    const https = require('https');
    
    await handler(req, res);
    
    expect(https.request).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle Reddit API 403 errors from proxy', async () => {
    process.env.PROXY_USER = 'user';
    process.env.PROXY_PASS = 'pass';
    
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve(['test']);
      }
      return Promise.resolve(null);
    });
    
    // Mock 403 response from proxy
    const https = require('https');
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
    const { getStorage } = require('../../lib/storage');
    const mockStorage = getStorage();
    
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