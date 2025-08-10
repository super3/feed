const { getStorage } = require('../lib/storage');
const logger = require('../lib/logger');

module.exports = async (req, res) => {
  const storage = getStorage();
  const { method, url } = req;
  const pathname = url.split('?')[0];
  const endpoint = pathname.split('/filter-queue/')[1] || '';

  try {
    if (method === 'POST' && endpoint === 'add') {
      const posts = req.body.posts;
      const keyword = req.body.keyword;
      
      if (!posts || !Array.isArray(posts)) {
        return res.status(400).json({ error: 'Posts array is required' });
      }

      const timestamp = Date.now();
      const queueItems = [];

      for (const post of posts) {
        const queueKey = `queue:filter:${timestamp}:${post.id}`;
        const queueItem = {
          postId: post.id,
          title: post.title,
          selftext: post.selftext,
          keyword: keyword,
          timestamp: timestamp,
          status: 'pending',
          addedAt: new Date().toISOString()
        };
        
        await storage.set(queueKey, queueItem);
        queueItems.push({ key: queueKey, ...queueItem });
      }

      const stats = await storage.get('queue:stats') || { total: 0, pending: 0, processed: 0, failed: 0 };
      stats.total += posts.length;
      stats.pending += posts.length;
      await storage.set('queue:stats', stats);

      logger.info(`Added ${posts.length} posts to filter queue`);
      return res.status(200).json({ 
        message: 'Posts added to queue', 
        count: posts.length,
        items: queueItems 
      });
    }

    if (method === 'GET' && endpoint === 'next') {
      const clientId = req.query.client_id || 'default';
      const keys = await storage.keys('queue:filter:*');
      
      for (const key of keys) {
        const item = await storage.get(key);
        if (item && item.status === 'pending') {
          item.status = 'processing';
          item.clientId = clientId;
          item.startedAt = new Date().toISOString();
          
          await storage.set(key, item);
          
          const processingKey = `queue:processing:${clientId}:${item.postId}`;
          await storage.set(processingKey, { key, startedAt: item.startedAt });
          
          logger.info(`Assigned queue item ${key} to client ${clientId}`);
          return res.status(200).json({ key, item });
        }
      }
      
      return res.status(204).end();
    }

    if (method === 'POST' && endpoint === 'result') {
      const { key, result, clientId } = req.body;
      
      if (!key || !result || !clientId) {
        return res.status(400).json({ error: 'Key, result, and clientId are required' });
      }

      const item = await storage.get(key);
      if (!item) {
        return res.status(404).json({ error: 'Queue item not found' });
      }

      item.status = 'completed';
      item.result = result;
      item.completedAt = new Date().toISOString();
      await storage.set(key, item);

      const resultKey = `queue:results:${item.postId}`;
      await storage.set(resultKey, {
        postId: item.postId,
        relevant: result.relevant,
        reasoning: result.reasoning,
        confidence: result.confidence,
        keyword: item.keyword,
        completedAt: item.completedAt
      });

      const processingKey = `queue:processing:${clientId}:${item.postId}`;
      await storage.delete(processingKey);

      const stats = await storage.get('queue:stats') || { total: 0, pending: 0, processed: 0, failed: 0 };
      stats.pending = Math.max(0, stats.pending - 1);
      stats.processed += 1;
      await storage.set('queue:stats', stats);

      logger.info(`Completed queue item ${key} with result: ${result.relevant}`);
      return res.status(200).json({ message: 'Result saved', item });
    }

    if (method === 'GET' && endpoint === 'status') {
      const stats = await storage.get('queue:stats') || { total: 0, pending: 0, processed: 0, failed: 0 };
      
      const queueKeys = await storage.keys('queue:filter:*');
      const pendingItems = [];
      const processingItems = [];
      const completedItems = [];
      
      for (const key of queueKeys.slice(0, 100)) {
        const item = await storage.get(key);
        if (item) {
          if (item.status === 'pending') pendingItems.push({ key, ...item });
          else if (item.status === 'processing') processingItems.push({ key, ...item });
          else if (item.status === 'completed') completedItems.push({ key, ...item });
        }
      }

      const processingKeys = await storage.keys('queue:processing:*');
      const activeClients = new Set();
      for (const key of processingKeys) {
        const clientId = key.split(':')[2];
        activeClients.add(clientId);
      }

      return res.status(200).json({
        stats,
        pending: pendingItems.length,
        processing: processingItems.length,
        completed: completedItems.length,
        activeClients: Array.from(activeClients),
        recentItems: {
          pending: pendingItems.slice(0, 5),
          processing: processingItems.slice(0, 5),
          completed: completedItems.slice(0, 5)
        }
      });
    }

    if (method === 'POST' && endpoint === 'cleanup') {
      const maxAge = parseInt(req.body.maxAge) || 3600000;
      const now = Date.now();
      const keys = await storage.keys('queue:filter:*');
      let cleaned = 0;

      for (const key of keys) {
        const item = await storage.get(key);
        if (item && item.status === 'completed') {
          const timestamp = parseInt(key.split(':')[2]);
          if (now - timestamp > maxAge) {
            await storage.delete(key);
            cleaned++;
          }
        }
      }

      logger.info(`Cleaned up ${cleaned} old queue items`);
      return res.status(200).json({ message: `Cleaned up ${cleaned} items` });
    }

    if (method === 'POST' && endpoint === 'reset-stuck') {
      const timeout = parseInt(req.body.timeout) || 300000;
      const now = Date.now();
      const keys = await storage.keys('queue:filter:*');
      let reset = 0;

      for (const key of keys) {
        const item = await storage.get(key);
        if (item && item.status === 'processing' && item.startedAt) {
          const startTime = new Date(item.startedAt).getTime();
          if (now - startTime > timeout) {
            const clientId = item.clientId; // Save before deleting
            item.status = 'pending';
            delete item.clientId;
            delete item.startedAt;
            await storage.set(key, item);
            
            if (clientId) {
              const processingKey = `queue:processing:${clientId}:${item.postId}`;
              await storage.delete(processingKey);
            }
            reset++;
          }
        }
      }

      const stats = await storage.get('queue:stats') || { total: 0, pending: 0, processed: 0, failed: 0 };
      stats.pending += reset;
      await storage.set('queue:stats', stats);

      logger.info(`Reset ${reset} stuck queue items`);
      return res.status(200).json({ message: `Reset ${reset} stuck items` });
    }

    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    logger.error('Filter queue error:', error);
    return res.status(500).json({ error: error.message });
  }
};