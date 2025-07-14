const { getStorage } = require('../lib/storage');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get configuration from environment or use defaults
  const modelName = process.env.LM_STUDIO_MODEL || 'deepseek/deepseek-r1-0528-qwen3-8b';
  const lmStudioUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';
  const requestTimeout = parseInt(process.env.LM_STUDIO_TIMEOUT || '60000'); // Default 60 seconds

  try {
    const { keyword, context, postId } = req.body;

    if (!keyword || !context || !postId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize storage
    const storage = getStorage();
    await storage.init();
    
    // Get all post files for this keyword
    const keys = await storage.keys(`posts:${keyword}:*`);
    let postFound = false;
    let result = null;
    
    // Process each post file to find the specific post
    for (const key of keys) {
      const data = await storage.get(key);
      if (!data || !data.posts) continue;
      
      // Find the post index
      const postIndex = data.posts.findIndex(p => p.id === postId);
      if (postIndex === -1) continue;
      
      postFound = true;
      const post = data.posts[postIndex];
      
      try {
        // Clean up HTML entities and limit content length
        const cleanContent = (post.selftext || 'No text content')
          .replace(/&amp;/g, '&')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .substring(0, 2000); // Limit to 2000 chars
        
        const prompt = `Analyze this Reddit post:
Title: ${post.title}
Content: ${cleanContent}

Question: Is this post about "${keyword}" specifically in the context of "${context}"?

Reply with only YES or NO.`;

        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), requestTimeout);
        
        let response;
        try {
          response = await fetch(`${lmStudioUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: 'system',
                  content: 'You are a content analyzer. Answer questions with only YES or NO. Do not use any XML tags or explain your reasoning.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.1,
              max_tokens: 1000,
              stream: false
            }),
            signal: controller.signal
          });
        } catch (fetchError) {
          if (fetchError.name === 'AbortError') {
            console.error(`Request timeout for post ${post.id}`);
            return res.status(200).json({ id: post.id, error: 'Request timed out' });
          }
          throw fetchError;
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          console.error('LM Studio error:', response.status);
          return res.status(200).json({ id: post.id, error: 'LM Studio error' });
        }

        const aiResponse = await response.json();
        const fullResponse = aiResponse.choices?.[0]?.message?.content || '';
        
        // Extract YES or NO from response
        const cleanResponse = fullResponse.replace(/<[^>]*>/g, '').trim().toUpperCase();
        const isRelevant = cleanResponse.includes('YES');
        
        // Update the post with filter information
        data.posts[postIndex] = {
          ...post,
          filterContext: context,
          isRelevant: isRelevant,
          filterReason: fullResponse,
          filteredAt: new Date().toISOString()
        };
        
        // Save the updated data
        await storage.set(key, data);
        
        result = {
          id: post.id,
          relevant: isRelevant,
          reasoning: fullResponse
        };
        
      } catch (error) {
        console.error('Error processing post:', error);
        result = { id: post.id, error: error.message };
      }
      
      break; // Found and processed the post
    }

    if (!postFound) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Filter context individual error:', error);
    res.status(500).json({ 
      error: 'Failed to filter post', 
      details: error.message,
      hint: `Make sure LM Studio is running on ${lmStudioUrl}`,
      model: modelName
    });
  }
};