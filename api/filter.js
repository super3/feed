const storage = require('../lib/storage');
const { handleError } = require('../lib/utils/error-handler');

module.exports = async (req, res) => {
  const { method, query, body } = req;
  const { action } = query;

  try {
    // Handle filter queue operations
    if (action === 'queue') {
      if (method === 'GET') {
        const queue = await storage.get('filter:queue') || [];
        return res.status(200).json({ queue });
      }

      if (method === 'POST') {
        const { postId } = body;
        if (!postId) {
          return res.status(400).json({ error: 'Post ID is required' });
        }

        const queue = await storage.get('filter:queue') || [];
        if (!queue.includes(postId)) {
          queue.push(postId);
          await storage.set('filter:queue', queue);
        }

        return res.status(200).json({ 
          message: 'Post added to filter queue',
          queue 
        });
      }

      if (method === 'DELETE') {
        const { postId } = body;
        if (!postId) {
          return res.status(400).json({ error: 'Post ID is required' });
        }

        const queue = await storage.get('filter:queue') || [];
        const index = queue.indexOf(postId);
        
        if (index > -1) {
          queue.splice(index, 1);
          await storage.set('filter:queue', queue);
          return res.status(200).json({ 
            message: 'Post removed from filter queue',
            queue 
          });
        }

        return res.status(404).json({ error: 'Post not found in queue' });
      }
    }

    // Handle clear filter operations
    if (action === 'clear' && method === 'POST') {
      const { keyword, postIds } = body;
      
      if (keyword) {
        const keys = await storage.keys(`posts:${keyword}:*`);
        
        if (keys.length === 0) {
          return res.status(404).json({ 
            error: `No posts found for keyword: ${keyword}` 
          });
        }

        for (const key of keys) {
          await storage.del(key);
        }

        return res.status(200).json({ 
          message: `Successfully cleared ${keys.length} post entries for keyword: ${keyword}`,
          clearedCount: keys.length
        });
      }

      if (postIds && Array.isArray(postIds)) {
        let clearedCount = 0;
        const keywords = await storage.get('config:keywords') || ['hackernews'];
        
        for (const keyword of keywords) {
          const keys = await storage.keys(`posts:${keyword}:*`);
          
          for (const key of keys) {
            const posts = await storage.get(key);
            if (posts && Array.isArray(posts)) {
              const filteredPosts = posts.map(post => {
                if (postIds.includes(post.id)) {
                  const { filterResult, filterContext, ...cleanPost } = post;
                  clearedCount++;
                  return cleanPost;
                }
                return post;
              });
              
              await storage.set(key, filteredPosts);
            }
          }
        }

        return res.status(200).json({ 
          message: `Cleared filter data from ${clearedCount} posts`,
          clearedCount 
        });
      }

      return res.status(400).json({ error: 'Either keyword or postIds is required' });
    }

    // Handle filter context operations (from filter-context.js)
    if (action === 'context') {
      const filterModule = require('../lib/filter');
      
      if (method === 'POST') {
        const { keyword, context, posts } = body;
        
        if (!keyword || !context || !posts) {
          return res.status(400).json({ 
            error: 'Keyword, context, and posts are required' 
          });
        }

        const filterResults = await filterModule.filterPosts(posts, context);
        
        const keys = await storage.keys(`posts:${keyword}:*`);
        let updatedCount = 0;
        
        for (const key of keys) {
          const storedPosts = await storage.get(key);
          if (!storedPosts || !Array.isArray(storedPosts)) continue;
          
          let modified = false;
          const updatedPosts = storedPosts.map(post => {
            const filterResult = filterResults.find(r => r.id === post.id);
            if (filterResult) {
              modified = true;
              updatedCount++;
              return {
                ...post,
                filterResult: filterResult.shouldShow,
                filterContext: context
              };
            }
            return post;
          });
          
          if (modified) {
            await storage.set(key, updatedPosts);
          }
        }
        
        return res.status(200).json({ 
          message: 'Posts filtered successfully',
          totalProcessed: filterResults.length,
          updatedInStorage: updatedCount,
          results: filterResults
        });
      }

      if (method === 'GET') {
        const { postId } = query;
        
        if (!postId) {
          return res.status(400).json({ error: 'Post ID is required' });
        }

        const keywords = await storage.get('config:keywords') || ['hackernews'];
        
        for (const keyword of keywords) {
          const keys = await storage.keys(`posts:${keyword}:*`);
          
          for (const key of keys) {
            const posts = await storage.get(key);
            if (posts && Array.isArray(posts)) {
              const post = posts.find(p => p.id === postId);
              if (post && post.filterResult !== undefined) {
                return res.status(200).json({
                  id: post.id,
                  filterResult: post.filterResult,
                  filterContext: post.filterContext
                });
              }
            }
          }
        }
        
        return res.status(404).json({ error: 'Post not found or not filtered yet' });
      }
    }

    // Handle individual context operations (from filter-context-individual.js)
    if (action === 'context-individual') {
      const { id } = query;
      
      if (method === 'GET') {
        if (!id) {
          return res.status(400).json({ error: 'Context ID is required' });
        }

        const contexts = await storage.get('filter:contexts') || [];
        const context = contexts.find(c => c.id === id);

        if (!context) {
          return res.status(404).json({ error: 'Context not found' });
        }

        return res.status(200).json({ context });
      }

      if (method === 'PUT') {
        if (!id) {
          return res.status(400).json({ error: 'Context ID is required' });
        }

        const { name, description, rules } = body;
        const contexts = await storage.get('filter:contexts') || [];
        const index = contexts.findIndex(c => c.id === id);

        if (index === -1) {
          return res.status(404).json({ error: 'Context not found' });
        }

        contexts[index] = {
          ...contexts[index],
          ...(name && { name }),
          ...(description && { description }),
          ...(rules && { rules }),
          updatedAt: new Date().toISOString()
        };

        await storage.set('filter:contexts', contexts);

        return res.status(200).json({ 
          message: 'Context updated',
          context: contexts[index] 
        });
      }

      if (method === 'DELETE') {
        if (!id) {
          return res.status(400).json({ error: 'Context ID is required' });
        }

        const contexts = await storage.get('filter:contexts') || [];
        const index = contexts.findIndex(c => c.id === id);

        if (index === -1) {
          return res.status(404).json({ error: 'Context not found' });
        }

        const deleted = contexts.splice(index, 1)[0];
        await storage.set('filter:contexts', contexts);

        return res.status(200).json({ 
          message: 'Context deleted',
          context: deleted 
        });
      }
    }

    return res.status(400).json({ 
      error: 'Invalid action. Valid actions: queue, clear, context, context-individual' 
    });

  } catch (error) {
    return handleError(res, error, 'Filter operation failed');
  }
};