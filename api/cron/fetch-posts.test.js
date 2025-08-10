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
        success: true,
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
        success: true,
        keywords: ['javascript', 'react'],
        totalNewPosts: 2
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
        success: true,
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
        success: true,
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

  it('should accept both GET and POST requests', async () => {
    req.method = 'POST';
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
        success: true
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
        success: true,
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
      
      return {
        on: jest.fn(),
        end: jest.fn()
      };
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          test: expect.objectContaining({
            error: expect.stringContaining('Invalid JSON response')
          })
        })
      })
    );

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

    // Mock fetch to return error
    global.fetch.mockRejectedValue(new Error('Reddit API error'));

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          test: expect.objectContaining({
            error: expect.stringContaining('Reddit API error')
          })
        })
      })
    );
  });

  it('should handle Reddit API error with error property', async () => {
    mockStorage.get.mockImplementation((key) => {
      if (key === 'config:keywords') return ['test'];
      return null;
    });
    mockStorage.keys.mockResolvedValue([]);

    // Mock fetch to return error status
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: jest.fn().mockResolvedValue({})
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          test: expect.objectContaining({
            error: expect.stringContaining('Reddit API error')
          })
        })
      })
    );
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
      
      return {
        on: jest.fn(),
        end: jest.fn()
      };
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          test: expect.objectContaining({
            success: true,
            newPosts: 0,
            totalFound: 0
          })
        })
      })
    );

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
      
      return {
        on: jest.fn(),
        end: jest.fn()
      };
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          test: expect.objectContaining({
            error: expect.stringContaining('Reddit API error: 500')
          })
        })
      })
    );

    // Cleanup
    delete process.env.VERCEL;
    delete process.env.PROXY_USER;
    delete process.env.PROXY_PASS;
    delete process.env.PROXY_HOST;
  });
});