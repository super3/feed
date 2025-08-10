#!/usr/bin/env node

const FEED_API_URL = process.env.FEED_API_URL || 'http://localhost:3000';
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
const CLIENT_ID = process.env.CLIENT_ID || `worker-${Date.now()}`;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 5000;
const WORKER_AUTH_TOKEN = process.env.WORKER_AUTH_TOKEN || '';

console.log(`Filter Client Worker starting...`);
console.log(`Client ID: ${CLIENT_ID}`);
console.log(`Feed API: ${FEED_API_URL}`);
console.log(`LM Studio: ${LM_STUDIO_URL}`);
console.log(`Poll Interval: ${POLL_INTERVAL}ms`);

async function fetchNext() {
  try {
    const response = await fetch(`${FEED_API_URL}/api/filter-queue/next?client_id=${CLIENT_ID}`, {
      headers: WORKER_AUTH_TOKEN ? { 'Authorization': `Bearer ${WORKER_AUTH_TOKEN}` } : {}
    });
    
    if (response.status === 204) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch next item: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching next item:', error);
    return null;
  }
}

async function processWithLMStudio(item) {
  const prompt = `You are a helpful assistant that determines if Reddit posts are relevant to a specific topic.

Topic: "${item.keyword}"

Reddit Post Title: "${item.title}"
Reddit Post Content: "${item.selftext || 'No content'}"

Is this post relevant to the topic "${item.keyword}"? Consider:
1. Does the post directly discuss the topic?
2. Is it asking questions about the topic?
3. Is it sharing news, updates, or experiences related to the topic?
4. Ignore posts that only mention the keyword in passing or unrelated context.

Respond with a JSON object containing:
- "relevant": true or false
- "reasoning": brief explanation (1-2 sentences)
- "confidence": number between 0 and 1

Example response:
{"relevant": true, "reasoning": "The post discusses new features in the latest update.", "confidence": 0.9}`;

  try {
    const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-model',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes Reddit posts for relevance. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse LM Studio response:', content);
      return {
        relevant: false,
        reasoning: 'Failed to parse AI response',
        confidence: 0
      };
    }
  } catch (error) {
    console.error('Error calling LM Studio:', error);
    return {
      relevant: false,
      reasoning: `AI processing error: ${error.message}`,
      confidence: 0
    };
  }
}

async function submitResult(key, result) {
  try {
    const response = await fetch(`${FEED_API_URL}/api/filter-queue/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WORKER_AUTH_TOKEN ? { 'Authorization': `Bearer ${WORKER_AUTH_TOKEN}` } : {})
      },
      body: JSON.stringify({
        key,
        result,
        clientId: CLIENT_ID
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to submit result: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error submitting result:', error);
    throw error;
  }
}

async function checkLMStudioHealth() {
  try {
    const response = await fetch(`${LM_STUDIO_URL}/v1/models`);
    if (response.ok) {
      const data = await response.json();
      console.log(`LM Studio is healthy. Available models:`, data.data.map(m => m.id));
      return true;
    }
  } catch (error) {
    console.error('LM Studio health check failed:', error.message);
  }
  return false;
}

async function mainLoop() {
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  
  console.log('Checking LM Studio availability...');
  const lmStudioAvailable = await checkLMStudioHealth();
  
  if (!lmStudioAvailable) {
    console.warn('WARNING: LM Studio is not responding. Worker will retry but may fail to process items.');
  }

  console.log('Starting main processing loop...');
  
  while (true) {
    try {
      const queueItem = await fetchNext();
      
      if (!queueItem) {
        console.log(`[${new Date().toISOString()}] No items in queue, waiting...`);
        await sleep(POLL_INTERVAL);
        consecutiveErrors = 0;
        continue;
      }
      
      console.log(`Processing item: ${queueItem.key}`);
      console.log(`  Post ID: ${queueItem.item.postId}`);
      console.log(`  Title: ${queueItem.item.title.substring(0, 80)}...`);
      
      const result = await processWithLMStudio(queueItem.item);
      console.log(`  Result: ${result.relevant ? 'RELEVANT' : 'NOT RELEVANT'} (confidence: ${result.confidence})`);
      
      await submitResult(queueItem.key, result);
      console.log(`  ✓ Result submitted successfully`);
      
      consecutiveErrors = 0;
      
      await sleep(100);
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`Error in main loop (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error('Too many consecutive errors. Pausing for 30 seconds...');
        await sleep(30000);
        consecutiveErrors = 0;
        
        console.log('Rechecking LM Studio health...');
        await checkLMStudioHealth();
      } else {
        await sleep(POLL_INTERVAL);
      }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('SIGINT', () => {
  console.log('\nShutting down filter client worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down filter client worker...');
  process.exit(0);
});

mainLoop().catch(error => {
  console.error('Fatal error in main loop:', error);
  process.exit(1);
});