const httpMocks = require('node-mocks-http');
const fetchRedditHandler = require('./fetch-reddit');
const { getStorage } = require('../lib/storage');

// Mock storage
jest.mock('../lib/storage', () => ({
  getStorage: jest.fn()
}));

// Mock global fetch
global.fetch = jest.fn();

describe('/api/fetch-reddit', () => {
  let mockStorage;
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorage = {
      init: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
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
    mockStorage.get.mockResolvedValue(['javascript', 'react']);
    mockStorage.smembers.mockResolvedValue([]); // No previous posts
    mockStorage.sadd.mockResolvedValue(1);

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
    expect(data.results.javascript.count).toBe(1);
    expect(data.results.javascript.posts[0].title).toBe('JavaScript Tips');
    
    // Verify storage calls
    expect(mockStorage.sadd).toHaveBeenCalledWith('posted:javascript', 'post1');
    expect(mockStorage.set).toHaveBeenCalledWith(
      expect.stringMatching(/^posts:javascript:\d+$/),
      expect.objectContaining({
        timestamp: expect.any(String),
        count: 1,
        posts: expect.any(Array)
      })
    );
  });

  it('should use default keyword if none configured', async () => {
    mockStorage.get.mockResolvedValue(null);
    mockStorage.smembers.mockResolvedValue([]);
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { children: [] } })
    });

    await fetchRedditHandler(req, res);

    expect(mockStorage.set).toHaveBeenCalledWith('config:keywords', ['slack']);
    const data = JSON.parse(res._getData());
    expect(data.keywords).toEqual(['slack']);
  });

  it('should skip already posted items', async () => {
    mockStorage.get.mockResolvedValue(['javascript']);
    mockStorage.smembers.mockResolvedValue(['existing-post-id']); // Already posted
    
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
    expect(data.results.javascript.count).toBe(1);
    expect(data.results.javascript.posts[0].id).toBe('new-post-id');
  });

  it('should handle Reddit API errors', async () => {
    mockStorage.get.mockResolvedValue(['javascript']);
    mockStorage.smembers.mockResolvedValue([]);
    
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
    mockStorage.get.mockResolvedValue(['test']);
    mockStorage.smembers.mockResolvedValue([]);
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
});