const httpMocks = require('node-mocks-http');

// Create mock storage object
const mockStorage = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn()
};

// Mock dependencies before requiring the module
jest.mock('../lib/storage', () => mockStorage);

jest.mock('../lib/utils/error-handler', () => ({
  handleError: jest.fn((res, error, message) => {
    return res.status(500).json({
      error: message,
      details: error.message
    });
  })
}));

jest.mock('../lib/filter', () => ({
  filterPosts: jest.fn()
}));

const filter = require('./filter');
const { filterPosts } = require('../lib/filter');

describe('Filter API', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
  });

  describe('Queue operations', () => {
    it('should return the filter queue', async () => {
      const mockQueue = ['post1', 'post2'];
      mockStorage.get.mockResolvedValue(mockQueue);

      req.method = 'GET';
      req.query = { action: 'queue' };

      await filter(req, res);

      expect(mockStorage.get).toHaveBeenCalledWith('filter:queue');
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ queue: mockQueue });
    });

    it('should add post to queue', async () => {
      mockStorage.get.mockResolvedValue(['existing']);
      mockStorage.set.mockResolvedValue(true);

      req.method = 'POST';
      req.query = { action: 'queue' };
      req.body = { postId: 'newPost' };

      await filter(req, res);

      expect(mockStorage.set).toHaveBeenCalledWith('filter:queue', ['existing', 'newPost']);
      expect(res._getStatusCode()).toBe(200);
    });

    it('should remove post from queue', async () => {
      mockStorage.get.mockResolvedValue(['post1', 'post2', 'post3']);
      mockStorage.set.mockResolvedValue(true);

      req.method = 'DELETE';
      req.query = { action: 'queue' };
      req.body = { postId: 'post2' };

      await filter(req, res);

      expect(mockStorage.set).toHaveBeenCalledWith('filter:queue', ['post1', 'post3']);
      expect(res._getStatusCode()).toBe(200);
    });

    it('should return error if postId is missing for POST', async () => {
      req.method = 'POST';
      req.query = { action: 'queue' };
      req.body = {};

      await filter(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Post ID is required' });
    });

    it('should return error if postId is missing for DELETE', async () => {
      req.method = 'DELETE';
      req.query = { action: 'queue' };
      req.body = {};

      await filter(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Post ID is required' });
    });

    it('should return 404 if post not in queue', async () => {
      mockStorage.get.mockResolvedValue(['post1']);

      req.method = 'DELETE';
      req.query = { action: 'queue' };
      req.body = { postId: 'notFound' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(404);
    });
  });

  describe('Clear operations', () => {
    it('should clear posts for keyword', async () => {
      const mockKeys = ['posts:test:1', 'posts:test:2'];
      mockStorage.keys.mockResolvedValue(mockKeys);
      mockStorage.del.mockResolvedValue(true);

      req.method = 'POST';
      req.query = { action: 'clear' };
      req.body = { keyword: 'test' };

      await filter(req, res);

      expect(mockStorage.keys).toHaveBeenCalledWith('posts:test:*');
      expect(mockStorage.del).toHaveBeenCalledTimes(2);
      expect(res._getStatusCode()).toBe(200);
    });

    it('should return 404 if no posts found for keyword', async () => {
      mockStorage.keys.mockResolvedValue([]);

      req.method = 'POST';
      req.query = { action: 'clear' };
      req.body = { keyword: 'test' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(404);
    });

    it('should clear filter data from specific posts', async () => {
      const mockPosts = [
        { id: 'post1', title: 'Test', filterResult: true, filterContext: 'context' },
        { id: 'post2', title: 'Test2' }
      ];
      
      mockStorage.get.mockImplementation((key) => {
        if (key === 'config:keywords') return ['test'];
        if (key.startsWith('posts:')) return mockPosts;
        return null;
      });
      mockStorage.keys.mockResolvedValue(['posts:test:123']);
      mockStorage.set.mockResolvedValue(true);

      req.method = 'POST';
      req.query = { action: 'clear' };
      req.body = { postIds: ['post1'] };

      await filter(req, res);

      expect(mockStorage.set).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(200);
    });

    it('should return error if neither keyword nor postIds provided', async () => {
      req.method = 'POST';
      req.query = { action: 'clear' };
      req.body = {};

      await filter(req, res);

      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe('Context operations', () => {
    it('should filter posts with context', async () => {
      const mockPosts = [
        { id: 'post1', title: 'Test' },
        { id: 'post2', title: 'Test2' }
      ];
      const mockFilterResults = [
        { id: 'post1', shouldShow: true },
        { id: 'post2', shouldShow: false }
      ];

      filterPosts.mockResolvedValue(mockFilterResults);
      mockStorage.keys.mockResolvedValue(['posts:test:123']);
      mockStorage.get.mockResolvedValue(mockPosts);
      mockStorage.set.mockResolvedValue(true);

      req.method = 'POST';
      req.query = { action: 'context' };
      req.body = {
        keyword: 'test',
        context: 'test context',
        posts: mockPosts
      };

      await filter(req, res);

      expect(filterPosts).toHaveBeenCalledWith(mockPosts, 'test context');
      expect(mockStorage.set).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(200);
    });

    it('should return error if required fields missing', async () => {
      req.method = 'POST';
      req.query = { action: 'context' };
      req.body = { keyword: 'test' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should get filter result for specific post', async () => {
      const mockPost = {
        id: 'post1',
        title: 'Test',
        filterResult: true,
        filterContext: 'test context'
      };

      mockStorage.get.mockImplementation((key) => {
        if (key === 'config:keywords') return ['test'];
        if (key.startsWith('posts:')) return [mockPost];
        return null;
      });
      mockStorage.keys.mockResolvedValue(['posts:test:123']);

      req.method = 'GET';
      req.query = { action: 'context', postId: 'post1' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        id: 'post1',
        filterResult: true,
        filterContext: 'test context'
      });
    });

    it('should return 404 if post not found', async () => {
      mockStorage.get.mockResolvedValue([]);
      mockStorage.keys.mockResolvedValue([]);

      req.method = 'GET';
      req.query = { action: 'context', postId: 'notFound' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(404);
    });

    it('should return error if postId missing', async () => {
      req.method = 'GET';
      req.query = { action: 'context' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe('Context individual operations', () => {
    it('should get individual context', async () => {
      const mockContext = {
        id: '123',
        name: 'Test Context',
        description: 'Test',
        rules: 'Rules'
      };
      mockStorage.get.mockResolvedValue([mockContext]);

      req.method = 'GET';
      req.query = { action: 'context-individual', id: '123' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ context: mockContext });
    });

    it('should return 404 if context not found', async () => {
      mockStorage.get.mockResolvedValue([]);

      req.method = 'GET';
      req.query = { action: 'context-individual', id: 'notFound' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(404);
    });

    it('should update context', async () => {
      const mockContexts = [{
        id: '123',
        name: 'Old Name',
        description: 'Old Desc',
        rules: 'Old Rules'
      }];
      mockStorage.get.mockResolvedValue(mockContexts);
      mockStorage.set.mockResolvedValue(true);

      req.method = 'PUT';
      req.query = { action: 'context-individual', id: '123' };
      req.body = { name: 'New Name' };

      await filter(req, res);

      expect(mockStorage.set).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(200);
    });

    it('should delete context', async () => {
      const mockContext = {
        id: '123',
        name: 'Test Context'
      };
      mockStorage.get.mockResolvedValue([mockContext]);
      mockStorage.set.mockResolvedValue(true);

      req.method = 'DELETE';
      req.query = { action: 'context-individual', id: '123' };

      await filter(req, res);

      expect(mockStorage.set).toHaveBeenCalledWith('filter:contexts', []);
      expect(res._getStatusCode()).toBe(200);
    });

    it('should return error if id missing', async () => {
      req.method = 'GET';
      req.query = { action: 'context-individual' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should return 400 for invalid action', async () => {
      req.method = 'GET';
      req.query = { action: 'invalid' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage error'));

      req.method = 'GET';
      req.query = { action: 'queue' };

      await filter(req, res);

      expect(res._getStatusCode()).toBe(500);
    });
  });
});