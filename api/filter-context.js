const { getStorage } = require('../lib/storage');
const { success, methodNotAllowed, badRequest, serverError } = require('../lib/utils/error-handler');
const logger = require('../lib/logger');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const storage = getStorage();
  await storage.init();

  if (req.method === 'POST') {
    try {
      const { keyword, context, posts } = req.body;

      if (!keyword || !context) {
        return badRequest(res, 'Keyword and context are required');
      }

      if (!posts || !Array.isArray(posts)) {
        return badRequest(res, 'Posts array is required');
      }

      const postsToQueue = posts.map(post => ({
        id: post.id,
        title: post.title,
        selftext: post.selftext || ''
      }));

      const response = await fetch(`${req.headers.host ? 'http://' + req.headers.host : ''}/api/filter-queue/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: postsToQueue,
          keyword: `${keyword} (context: ${context})`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add posts to queue');
      }

      const result = await response.json();

      for (const post of posts) {
        const keys = await storage.keys(`posts:${keyword}:*`);
        for (const key of keys) {
          const data = await storage.get(key);
          if (!data || !data.posts) continue;
          
          const postIndex = data.posts.findIndex(p => p.id === post.id);
          if (postIndex !== -1) {
            data.posts[postIndex] = {
              ...data.posts[postIndex],
              filterContext: context,
              filterStatus: 'queued',
              queuedAt: new Date().toISOString()
            };
            await storage.set(key, data);
            break;
          }
        }
      }

      logger.info(`Queued ${posts.length} posts for filtering with context: ${context}`);
      
      return success(res, {
        message: 'Posts queued for filtering',
        count: result.count,
        queueItems: result.items
      });

    } catch (error) {
      return serverError(res, error, { 
        context: 'Failed to queue posts for filtering'
      });
    }
  }

  if (req.method === 'GET') {
    try {
      const { postId } = req.query;
      
      if (!postId) {
        const stats = await storage.get('queue:stats') || { total: 0, pending: 0, processed: 0, failed: 0 };
        return success(res, { stats });
      }

      const resultKey = `queue:results:${postId}`;
      const result = await storage.get(resultKey);
      
      if (!result) {
        const queueKeys = await storage.keys(`queue:filter:*:${postId}`);
        if (queueKeys.length > 0) {
          const queueItem = await storage.get(queueKeys[0]);
          if (queueItem) {
            return success(res, {
              postId,
              status: queueItem.status,
              queuedAt: queueItem.addedAt
            });
          }
        }
        
        return success(res, {
          postId,
          status: 'not_queued'
        });
      }

      return success(res, {
        postId,
        status: 'completed',
        relevant: result.relevant,
        reasoning: result.reasoning,
        confidence: result.confidence,
        completedAt: result.completedAt
      });

    } catch (error) {
      return serverError(res, error, { 
        context: 'Failed to get filter results'
      });
    }
  }

  return methodNotAllowed(res, ['POST', 'GET', 'OPTIONS']);
};