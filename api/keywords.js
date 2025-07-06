const { getStorage } = require('../lib/storage');

const KEYWORDS_KEY = 'config:keywords';

module.exports = async (req, res) => {
  try {
    const storage = getStorage();
    await storage.init();
    
    switch (req.method) {
      case 'GET':
        // Get all keywords
        const keywords = await storage.get(KEYWORDS_KEY) || [];
        return res.status(200).json({ keywords });
        
      case 'POST':
        // Add a new keyword
        const { keyword } = req.body;
        
        if (!keyword || typeof keyword !== 'string') {
          return res.status(400).json({ error: 'Invalid keyword' });
        }
        
        const currentKeywords = await storage.get(KEYWORDS_KEY) || [];
        
        if (currentKeywords.includes(keyword.toLowerCase())) {
          return res.status(409).json({ error: 'Keyword already exists' });
        }
        
        currentKeywords.push(keyword.toLowerCase());
        await storage.set(KEYWORDS_KEY, currentKeywords);
        
        return res.status(201).json({ 
          message: 'Keyword added successfully',
          keywords: currentKeywords 
        });
        
      case 'DELETE':
        // Remove a keyword
        const keywordToDelete = req.query.keyword || req.body.keyword;
        
        if (!keywordToDelete) {
          return res.status(400).json({ error: 'Keyword parameter required' });
        }
        
        const existingKeywords = await storage.get(KEYWORDS_KEY) || [];
        const filteredKeywords = existingKeywords.filter(k => k !== keywordToDelete.toLowerCase());
        
        if (existingKeywords.length === filteredKeywords.length) {
          return res.status(404).json({ error: 'Keyword not found' });
        }
        
        await storage.set(KEYWORDS_KEY, filteredKeywords);
        
        return res.status(200).json({ 
          message: 'Keyword deleted successfully',
          keywords: filteredKeywords 
        });
        
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};