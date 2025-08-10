const httpMocks = require('node-mocks-http');
const filterQueue = require('./filter-queue');
const { getStorage } = require('../lib/storage');

jest.mock('../lib/storage');
jest.mock('../lib/logger');

describe('Filter Queue API', () => {
  let req, res, mockStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorage = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn(),
      init: jest.fn()
    };
    
    getStorage.mockReturnValue(mockStorage);
    
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
  });

  describe('POST /api/filter-queue/add', () => {
    it('should add posts to the queue', async () => {
      req.method = 'POST';
      req.url = '/api/filter-queue/add';
      req.body = {
        posts: [
          { id: 'post1', title: 'Test Post 1', selftext: 'Content 1' },
          { id: 'post2', title: 'Test Post 2', selftext: 'Content 2' }
        ],
        keyword: 'javascript'
      };

      mockStorage.get.mockResolvedValue({ total: 0, pending: 0, processed: 0, failed: 0 });
      mockStorage.set.mockResolvedValue('OK');

      await filterQueue(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.message).toBe('Posts added to queue');
      expect(data.count).toBe(2);
      expect(data.items).toHaveLength(2);
      
      // Verify storage calls
      expect(mockStorage.set).toHaveBeenCalledTimes(3); // 2 posts + 1 stats update
      expect(mockStorage.set).toHaveBeenCalledWith(
        expect.stringMatching(/^queue:filter:\d+:post1$/),
        expect.objectContaining({
          postId: 'post1',
          title: 'Test Post 1',
          status: 'pending'
        })
      );
    });

    it('should return error for missing posts', async () => {
      req.method = 'POST';
      req.url = '/api/filter-queue/add';
      req.body = { keyword: 'javascript' };

      await filterQueue(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Posts array is required');
    });
  });

  describe('GET /api/filter-queue/next', () => {
    it('should return next pending item', async () => {
      req.method = 'GET';
      req.url = '/api/filter-queue/next?client_id=worker1';
      req.query = { client_id: 'worker1' };

      const queueItem = {
        postId: 'post1',
        title: 'Test Post',
        status: 'pending',
        timestamp: Date.now()
      };

      mockStorage.keys.mockResolvedValue(['queue:filter:123:post1']);
      mockStorage.get.mockResolvedValue(queueItem);
      mockStorage.set.mockResolvedValue('OK');

      await filterQueue(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.key).toBe('queue:filter:123:post1');
      expect(data.item.postId).toBe('post1');
      expect(data.item.status).toBe('processing');
      expect(data.item.clientId).toBe('worker1');
    });

    it('should return 204 when no items available', async () => {
      req.method = 'GET';
      req.url = '/api/filter-queue/next';
      req.query = {};

      mockStorage.keys.mockResolvedValue([]);

      await filterQueue(req, res);

      expect(res.statusCode).toBe(204);
    });
  });

  describe('POST /api/filter-queue/result', () => {
    it('should save filtering result', async () => {
      req.method = 'POST';
      req.url = '/api/filter-queue/result';
      req.body = {
        key: 'queue:filter:123:post1',
        result: {
          relevant: true,
          reasoning: 'Post is about JavaScript',
          confidence: 0.9
        },
        clientId: 'worker1'
      };

      const queueItem = {
        postId: 'post1',
        status: 'processing',
        keyword: 'javascript'
      };

      mockStorage.get.mockResolvedValue(queueItem)
        .mockResolvedValueOnce(queueItem)
        .mockResolvedValueOnce({ total: 10, pending: 5, processed: 4, failed: 0 });
      mockStorage.set.mockResolvedValue('OK');
      mockStorage.delete.mockResolvedValue(1);

      await filterQueue(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.message).toBe('Result saved');
      
      // Verify result was saved
      expect(mockStorage.set).toHaveBeenCalledWith(
        'queue:results:post1',
        expect.objectContaining({
          postId: 'post1',
          relevant: true,
          reasoning: 'Post is about JavaScript'
        })
      );
      
      // Verify stats were updated
      expect(mockStorage.set).toHaveBeenCalledWith(
        'queue:stats',
        expect.objectContaining({
          pending: 4,
          processed: 5
        })
      );
    });

    it('should return error for missing parameters', async () => {
      req.method = 'POST';
      req.url = '/api/filter-queue/result';
      req.body = { key: 'queue:filter:123:post1' };

      await filterQueue(req, res);

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Key, result, and clientId are required');
    });

    it('should return 404 for non-existent queue item', async () => {
      req.method = 'POST';
      req.url = '/api/filter-queue/result';
      req.body = {
        key: 'queue:filter:123:post1',
        result: { relevant: true },
        clientId: 'worker1'
      };

      mockStorage.get.mockResolvedValue(null);

      await filterQueue(req, res);

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Queue item not found');
    });
  });

  describe('GET /api/filter-queue/status', () => {
    it('should return queue status', async () => {
      req.method = 'GET';
      req.url = '/api/filter-queue/status';

      const stats = { total: 100, pending: 20, processed: 75, failed: 5 };
      const queueItems = [
        { status: 'pending', postId: 'post1' },
        { status: 'processing', postId: 'post2' },
        { status: 'completed', postId: 'post3' }
      ];

      mockStorage.get.mockResolvedValue(stats)
        .mockResolvedValueOnce(stats)
        .mockResolvedValueOnce(queueItems[0])
        .mockResolvedValueOnce(queueItems[1])
        .mockResolvedValueOnce(queueItems[2]);
      
      mockStorage.keys.mockResolvedValue(['queue:filter:1:post1', 'queue:filter:2:post2', 'queue:filter:3:post3'])
        .mockResolvedValueOnce(['queue:filter:1:post1', 'queue:filter:2:post2', 'queue:filter:3:post3'])
        .mockResolvedValueOnce(['queue:processing:worker1:post2']);

      await filterQueue(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.stats).toEqual(stats);
      expect(data.pending).toBe(1);
      expect(data.processing).toBe(1);
      expect(data.completed).toBe(1);
      expect(data.activeClients).toContain('worker1');
    });
  });

  describe('POST /api/filter-queue/cleanup', () => {
    it('should clean up old completed items', async () => {
      req.method = 'POST';
      req.url = '/api/filter-queue/cleanup';
      req.body = { maxAge: 3600000 }; // 1 hour

      const now = Date.now();
      const oldTimestamp = now - 7200000; // 2 hours ago
      const recentTimestamp = now - 1800000; // 30 minutes ago

      mockStorage.keys.mockResolvedValue([
        `queue:filter:${oldTimestamp}:post1`,
        `queue:filter:${recentTimestamp}:post2`
      ]);
      
      mockStorage.get.mockResolvedValueOnce({ status: 'completed' })
        .mockResolvedValueOnce({ status: 'completed' });
      
      mockStorage.delete.mockResolvedValue(1);

      await filterQueue(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.message).toBe('Cleaned up 1 items');
      expect(mockStorage.delete).toHaveBeenCalledTimes(1);
      expect(mockStorage.delete).toHaveBeenCalledWith(`queue:filter:${oldTimestamp}:post1`);
    });
  });

  describe('POST /api/filter-queue/reset-stuck', () => {
    it('should reset stuck processing items', async () => {
      req.method = 'POST';
      req.url = '/api/filter-queue/reset-stuck';
      req.body = { timeout: 300000 }; // 5 minutes

      const now = Date.now();
      const stuckItem = {
        status: 'processing',
        startedAt: new Date(now - 600000).toISOString(), // 10 minutes ago
        clientId: 'worker1',
        postId: 'post1'
      };

      mockStorage.keys.mockResolvedValue(['queue:filter:123:post1']);
      mockStorage.get.mockResolvedValue({ total: 10, pending: 5, processed: 4, failed: 0 })
        .mockResolvedValueOnce(stuckItem)
        .mockResolvedValueOnce({ total: 10, pending: 5, processed: 4, failed: 0 });
      mockStorage.set.mockResolvedValue('OK');
      mockStorage.delete.mockResolvedValue(1);

      await filterQueue(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.message).toBe('Reset 1 stuck items');
      
      // Verify item was reset to pending
      expect(mockStorage.set).toHaveBeenCalledWith(
        'queue:filter:123:post1',
        expect.objectContaining({
          status: 'pending',
          postId: 'post1'
        })
      );
      
      // Verify processing key was deleted (only if clientId exists in the item)
      // The stuck item has clientId, so this should be called
      expect(mockStorage.delete).toHaveBeenCalledWith('queue:processing:worker1:post1');
    });
  });

  describe('Invalid endpoint', () => {
    it('should return 404 for unknown endpoint', async () => {
      req.method = 'GET';
      req.url = '/api/filter-queue/unknown';

      await filterQueue(req, res);

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Endpoint not found');
    });
  });

  describe('Error handling', () => {
    it('should handle storage errors', async () => {
      req.method = 'GET';
      req.url = '/api/filter-queue/status';

      mockStorage.get.mockRejectedValue(new Error('Storage error'));

      await filterQueue(req, res);

      expect(res.statusCode).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Storage error');
    });
  });
});