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
  const batchSize = parseInt(process.env.LM_STUDIO_BATCH_SIZE || '3'); // Default 3 concurrent requests

  try {
    const { keyword, context, posts } = req.body;

    if (!keyword || !context || !posts || !Array.isArray(posts)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Process each post through LM Studio
    // Process in batches to avoid overwhelming LM Studio
    const results = [];
    let failedRequests = 0;
    
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (post, batchIndex) => {
        const index = i + batchIndex;
      try {
        // Clean up HTML entities and limit content length
        const cleanContent = (post.selftext || 'No text content')
          .replace(/&amp;/g, '&')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .substring(0, 2000); // Limit to 2000 chars to avoid token limits
        
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
            console.error(`Request timeout for post ${index}`);
            return { index, relevant: false, reasoning: 'Error: Request timed out' };
          }
          throw fetchError;
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          console.error('LM Studio error:', response.status);
          failedRequests++;
          return { index, relevant: false, reasoning: 'Error: Could not analyze this post' }; // Default to hiding post on error
        }

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error(`Failed to parse JSON for post ${index}:`, jsonError);
          failedRequests++;
          return { index, relevant: false, reasoning: 'Error: Invalid response from LM Studio' };
        }
        
        const fullResponse = data.choices?.[0]?.message?.content || '';
        
        // Log the raw response for debugging
        console.log(`Post ${index} - Raw LLM response: "${fullResponse}"`);
        
        // Extract YES or NO from the response, handling potential thinking tags
        let isRelevant = false; // Default to NOT showing the post (more conservative)
        
        // Remove any XML-like tags and extract the actual answer
        const cleanResponse = fullResponse.replace(/<[^>]*>/g, '').trim().toUpperCase();
        
        // Also look for "Answer: YES/NO" pattern
        const answerMatch = fullResponse.match(/Answer:\s*(YES|NO)/i);
        
        // Check if response appears truncated (doesn't end with punctuation or YES/NO)
        const lastChar = fullResponse.trim().slice(-1);
        const appearsTruncated = !['!', '.', '?', 'S', 'O'].includes(lastChar.toUpperCase());
        
        // Look for YES or NO in the response
        if (answerMatch) {
          // If we found "Answer: YES/NO", use that (most reliable)
          isRelevant = answerMatch[1].toUpperCase() === 'YES';
          console.log(`Post ${index} - Found answer pattern: ${answerMatch[1]}`);
        } else {
          // Look for standalone YES or NO at the end of the response or as a single line
          // This regex looks for YES or NO that appears alone on a line or at the very end
          const standaloneMatch = fullResponse.match(/(?:^|\n)\s*(YES|NO)\s*(?:\n|$)/i);
          
          if (standaloneMatch) {
            isRelevant = standaloneMatch[1].toUpperCase() === 'YES';
            console.log(`Post ${index} - Found standalone answer: ${standaloneMatch[1]}`);
          } else {
            // As a last resort, look for the LAST occurrence of YES or NO in the response
            // This helps when the thinking contains phrases like "I can't say yes" but concludes with NO
            const allYesNo = [...fullResponse.matchAll(/\b(YES|NO)\b/gi)];
            
            if (allYesNo.length > 0) {
              // Use the LAST occurrence
              const lastMatch = allYesNo[allYesNo.length - 1][1];
              isRelevant = lastMatch.toUpperCase() === 'YES';
              console.log(`Post ${index} - Using last YES/NO found: ${lastMatch}`);
            } else {
              // If response appears truncated, mark as error
              if (appearsTruncated) {
                console.warn(`Truncated response for post ${index}: "${fullResponse}"`);
                return { index, relevant: false, reasoning: fullResponse + '\n\n[Response appears truncated - defaulting to NO]' };
              }
              
              console.warn(`Ambiguous response for post ${index}: "${fullResponse}"`);
              // Default to false if we can't find any YES/NO
              isRelevant = false;
            }
          }
        }

        return { index, relevant: isRelevant, reasoning: fullResponse };
      } catch (error) {
        console.error('Error processing post:', error);
        failedRequests++;
        
        // If this looks like a connection error, throw to trigger 500 response
        if (error.message && error.message.includes('Connection refused')) {
          throw error;
        }
        
        return { index, relevant: false, reasoning: 'Error: Could not analyze this post' }; // Default to hiding post on error
      }
    }));
      
      results.push(...batchResults);
    }

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