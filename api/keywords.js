const { getStorage } = require('../lib/storage');
const { success, methodNotAllowed, badRequest, serverError, conflict, notFound, validation } = require('../lib/utils/error-handler');
const logger = require('../lib/logger');

const KEYWORDS_KEY = 'config:keywords';

module.exports = async (req, res) => {
  try {
    const storage = getStorage();
    logger.debug('Keywords API initialized', { storageType: storage.type, redisType: storage.redisType });
    await storage.init();
    
    switch (req.method) {
      case 'GET':
        // Get all keywords
        const keywords = await storage.get(KEYWORDS_KEY) || [];
        return success(res, { keywords }, {
          meta: { 
            count: keywords.length,
            timestamp: new Date().toISOString()
          }
        });
        
      case 'POST':
        // Add a new keyword
        const validationError = validation.validate(req.body, ['keyword'], { keyword: 'string' });
        if (validationError) {
          return badRequest(res, validationError);
        }
        
        const { keyword, context } = req.body;
        const currentKeywords = await storage.get(KEYWORDS_KEY) || [];
        
        // Check if keyword already exists (comparing just the keyword text)
        const exists = currentKeywords.some(k => 
          (typeof k === 'string' ? k : k.keyword) === keyword.toLowerCase()
        );
        
        if (exists) {
          return conflict(res, 'Keyword already exists');
        }
        
        // Store as object with keyword and context
        const keywordObj = {
          keyword: keyword.toLowerCase(),
          context: context || null
        };
        
        currentKeywords.push(keywordObj);
        await storage.set(KEYWORDS_KEY, currentKeywords);
        
        return success(res, { 
          keyword: keywordObj,
          keywords: currentKeywords 
        }, {
          status: 201,
          message: 'Keyword added successfully',
          meta: { 
            count: currentKeywords.length,
            timestamp: new Date().toISOString()
          }
        });
        
      case 'DELETE':
        // Remove a keyword
        const keywordToDelete = req.query.keyword || req.body.keyword;
        
        if (!keywordToDelete) {
          return badRequest(res, ['keyword']);
        }
        
        const existingKeywords = await storage.get(KEYWORDS_KEY) || [];
        const filteredKeywords = existingKeywords.filter(k => {
          const keywordText = typeof k === 'string' ? k : k.keyword;
          return keywordText !== keywordToDelete.toLowerCase();
        });
        
        if (existingKeywords.length === filteredKeywords.length) {
          return notFound(res, 'Keyword not found');
        }
        
        await storage.set(KEYWORDS_KEY, filteredKeywords);
        
        return success(res, { 
          keyword: keywordToDelete.toLowerCase(),
          keywords: filteredKeywords 
        }, {
          message: 'Keyword deleted successfully',
          meta: { 
            count: filteredKeywords.length,
            timestamp: new Date().toISOString()
          }
        });
        
      default:
        return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
    }
  } catch (error) {
    serverError(res, error, { context: 'Keywords API error' });
  }
};