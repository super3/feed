const { getStorage } = require('../lib/storage');
const { methodNotAllowed, badRequest, serverError } = require('../lib/utils/error-handler');

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
        const { keyword, context } = req.body;
        
        if (!keyword || typeof keyword !== 'string') {
          return badRequest(res, 'keyword (must be a string)');
        }
        
        const currentKeywords = await storage.get(KEYWORDS_KEY) || [];
        
        // Check if keyword already exists (comparing just the keyword text)
        const exists = currentKeywords.some(k => 
          (typeof k === 'string' ? k : k.keyword) === keyword.toLowerCase()
        );
        
        if (exists) {
          return res.status(409).json({ error: 'Keyword already exists' });
        }
        
        // Store as object with keyword and context
        const keywordObj = {
          keyword: keyword.toLowerCase(),
          context: context || null
        };
        
        currentKeywords.push(keywordObj);
        await storage.set(KEYWORDS_KEY, currentKeywords);
        
        return res.status(201).json({ 
          message: 'Keyword added successfully',
          keywords: currentKeywords 
        });
        
      case 'DELETE':
        // Remove a keyword
        const keywordToDelete = req.query.keyword || req.body.keyword;
        
        if (!keywordToDelete) {
          return badRequest(res, 'keyword');
        }
        
        const existingKeywords = await storage.get(KEYWORDS_KEY) || [];
        const filteredKeywords = existingKeywords.filter(k => {
          const keywordText = typeof k === 'string' ? k : k.keyword;
          return keywordText !== keywordToDelete.toLowerCase();
        });
        
        if (existingKeywords.length === filteredKeywords.length) {
          return res.status(404).json({ error: 'Keyword not found' });
        }
        
        await storage.set(KEYWORDS_KEY, filteredKeywords);
        
        return res.status(200).json({ 
          message: 'Keyword deleted successfully',
          keywords: filteredKeywords 
        });
        
      default:
        return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
    }
  } catch (error) {
    serverError(res, error, { context: 'Keywords API error' });
  }
};