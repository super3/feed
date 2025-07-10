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

  // Get model name from environment or use default
  const modelName = process.env.LM_STUDIO_MODEL || 'deepseek/deepseek-r1-0528-qwen3-8b';
  const lmStudioUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234';

  try {
    const { keyword, context, posts } = req.body;

    if (!keyword || !context || !posts || !Array.isArray(posts)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Process each post through LM Studio
    let failedRequests = 0;
    const results = await Promise.all(posts.map(async (post, index) => {
      try {
        const prompt = `Analyze this Reddit post:
Title: ${post.title}
Content: ${post.selftext || 'No text content'}

Question: Is this post about "${keyword}" specifically in the context of "${context}"?

Reply with only YES or NO.`;

        const response = await fetch(`${lmStudioUrl}/v1/chat/completions`, {
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
            max_tokens: 500,
            stream: false
          })
        });

        if (!response.ok) {
          console.error('LM Studio error:', response.status);
          failedRequests++;
          return { index, relevant: true }; // Default to showing post on error
        }

        const data = await response.json();
        const fullResponse = data.choices[0]?.message?.content || '';
        
        // Log the raw response for debugging
        console.log(`Post ${index} - Raw LLM response: "${fullResponse}"`);
        
        // Extract YES or NO from the response, handling potential thinking tags
        let isRelevant = true; // Default to showing the post
        
        // Remove any XML-like tags and extract the actual answer
        const cleanResponse = fullResponse.replace(/<[^>]*>/g, '').trim().toUpperCase();
        
        // Look for YES or NO in the response
        if (cleanResponse.includes('YES')) {
          isRelevant = true;
        } else if (cleanResponse.includes('NO')) {
          isRelevant = false;
        } else {
          // If we can't determine, check if the first word after cleaning is YES or NO
          const firstWord = cleanResponse.split(/\s+/)[0];
          if (firstWord === 'YES') {
            isRelevant = true;
          } else if (firstWord === 'NO') {
            isRelevant = false;
          }
          console.warn(`Ambiguous response for post ${index}: "${fullResponse}"`);
        }

        return { index, relevant: isRelevant };
      } catch (error) {
        console.error('Error processing post:', error);
        failedRequests++;
        
        // If this looks like a connection error, throw to trigger 500 response
        if (error.message && error.message.includes('Connection refused')) {
          throw error;
        }
        
        return { index, relevant: true }; // Default to showing post on error
      }
    }));

    // Don't throw error if we got responses but they were non-OK
    // Only throw if we couldn't connect at all

    res.status(200).json({ results });
  } catch (error) {
    console.error('Filter context error:', error);
    res.status(500).json({ 
      error: 'Failed to filter posts', 
      details: error.message,
      hint: `Make sure LM Studio is running on ${lmStudioUrl}`,
      model: modelName
    });
  }
};