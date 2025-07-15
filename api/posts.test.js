const httpMocks = require('node-mocks-http');
const postsHandler = require('./posts');
const { getStorage } = require('../lib/storage');

jest.mock('../lib/storage', () => ({
  getStorage: jest.fn()
}));

describe('/api/posts', () => {
  let mockStorage;
  let req, res;

  beforeEach(() => {
    mockStorage = {
      init: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn(),
      get: jest.fn()
    };
    getStorage.mockReturnValue(mockStorage);

    req = httpMocks.createRequest({ method: 'GET' });
    res = httpMocks.createResponse();
  });

  it('should return posts for specific keyword', async () => {
    req.query = { keyword: 'javascript' };
    
    mockStorage.keys.mockResolvedValue(['posts:javascript:1234', 'posts:javascript:5678']);
    mockStorage.get
      .mockResolvedValueOnce({
        timestamp: '2024-01-01T10:00:00Z',
        posts: [{
          id: '1',
          title: 'JS Post 1',
          created: '2024-01-01T09:00:00Z',
          keyword: 'javascript'
        }]
      })
      .mockResolvedValueOnce({
        timestamp: '2024-01-01T11:00:00Z',
        posts: [{
          id: '2',
          title: 'JS Post 2',
          created: '2024-01-01T10:00:00Z',
          keyword: 'javascript'
        }]
      });

    await postsHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.count).toBe(2);
    expect(data.keyword).toBe('javascript');
    expect(data.posts).toHaveLength(2);
    expect(data.posts[0].title).toBe('JS Post 2'); // Newer first
  });

  it('should return all posts when no keyword specified', async () => {
    mockStorage.keys.mockResolvedValue([
      'posts:javascript:1234',
      'posts:python:5678'
    ]);
    mockStorage.get
      .mockResolvedValueOnce({
        posts: [{
          id: '1',
          title: 'JS Post',
          created: '2024-01-01T09:00:00Z',
          keyword: 'javascript'
        }]
      })
      .mockResolvedValueOnce({
        posts: [{
          id: '2',
          title: 'Python Post',
          created: '2024-01-01T10:00:00Z',
          keyword: 'python'
        }]
      });

    await postsHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.keyword).toBe('all');
    expect(data.posts).toHaveLength(2);
  });

  it('should remove duplicate posts', async () => {
    mockStorage.keys.mockResolvedValue(['posts:all:1234', 'posts:all:5678']);
    mockStorage.get
      .mockResolvedValueOnce({
        posts: [{
          id: 'duplicate-id',
          title: 'Post 1',
          created: '2024-01-01T09:00:00Z'
        }]
      })
      .mockResolvedValueOnce({
        posts: [{
          id: 'duplicate-id',
          title: 'Post 1',
          created: '2024-01-01T09:00:00Z'
        }]
      });

    await postsHandler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.posts).toHaveLength(1);
  });

  it('should handle empty results', async () => {
    req.query = { keyword: 'nonexistent' };
    mockStorage.keys.mockResolvedValue([]);

    await postsHandler(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.count).toBe(0);
    expect(data.posts).toEqual([]);
  });

  it('should reject non-GET methods', async () => {
    req = httpMocks.createRequest({ method: 'POST' });
    res = httpMocks.createResponse();

    await postsHandler(req, res);

    expect(res.statusCode).toBe(405);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Method not allowed');
  });

  it('should handle storage errors', async () => {
    mockStorage.keys.mockRejectedValue(new Error('Storage error'));

    await postsHandler(req, res);

    expect(res.statusCode).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Failed to fetch posts');
    expect(data.message).toBe('Storage error');
  });
});