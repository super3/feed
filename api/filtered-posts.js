const { getStorage } = require('../lib/storage');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const storage = getStorage();
    await storage.init();
    
    const { keyword, context } = req.query;
    
    // Find the most recent filtered session for this keyword/context combination
    let pattern = 'filtered:*';
    if (keyword && context) {
      pattern = `filtered:${keyword}:${context}:*`;
    } else if (keyword) {
      pattern = `filtered:${keyword}:*`;
    }
    
    const keys = await storage.keys(pattern);
    
    if (keys.length === 0) {
      return res.status(200).json({
        filtered: false,
        posts: []
      });
    }
    
    // Sort keys to find the most recent session (keys include ISO timestamp)
    keys.sort((a, b) => b.localeCompare(a));
    
    // Get the most recent session
    const latestKey = keys[0];
    const sessionData = await storage.get(latestKey);
    
    if (!sessionData || sessionData.status !== 'completed') {
      return res.status(200).json({
        filtered: false,
        posts: []
      });
    }
    
    // Return the filtered results
    res.status(200).json({
      filtered: true,
      keyword: sessionData.keyword,
      context: sessionData.context,
      sessionId: sessionData.sessionId,
      stats: sessionData.stats,
      relevantPosts: sessionData.posts.relevant || [],
      notRelevantPosts: sessionData.posts.notRelevant || []
    });
    
  } catch (error) {
    console.error('Error fetching filtered posts:', error);
    res.status(500).json({ error: error.message });
  }
};