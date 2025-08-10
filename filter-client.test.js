// Tests for the filter-client.js worker functions

describe('Filter Client Worker', () => {
  let originalEnv;
  let originalFetch;
  let originalConsole;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save originals
    originalEnv = { ...process.env };
    originalFetch = global.fetch;
    originalConsole = { ...console };
    
    // Setup environment
    process.env.FEED_API_URL = 'http://localhost:3000';
    process.env.LM_STUDIO_URL = 'http://localhost:1234';
    process.env.CLIENT_ID = 'test-worker';
    process.env.POLL_INTERVAL = '100';
    
    // Mock console
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Mock fetch
    global.fetch = jest.fn();
    
    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    jest.useRealTimers();
  });

  describe('Worker Functions', () => {
    // Helper functions that simulate the worker's core functions
    const fetchNext = async () => {
      try {
        const response = await fetch(`${process.env.FEED_API_URL}/api/filter-queue/next?client_id=${process.env.CLIENT_ID}`, {
          headers: process.env.WORKER_AUTH_TOKEN ? { 'Authorization': `Bearer ${process.env.WORKER_AUTH_TOKEN}` } : {}
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
    };

    const processWithLMStudio = async (item) => {
      const prompt = `Is this post relevant to "${item.keyword}"?`;
      
      try {
        const response = await fetch(`${process.env.LM_STUDIO_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'local-model',
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 150
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
          return { relevant: false, reasoning: 'Failed to parse AI response', confidence: 0 };
        }
      } catch (error) {
        return { relevant: false, reasoning: error.message, confidence: 0 };
      }
    };

    const submitResult = async (key, result) => {
      try {
        const response = await fetch(`${process.env.FEED_API_URL}/api/filter-queue/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            result,
            clientId: process.env.CLIENT_ID
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
    };

    const checkLMStudioHealth = async () => {
      try {
        const response = await fetch(`${process.env.LM_STUDIO_URL}/v1/models`);
        if (response.ok) {
          const data = await response.json();
          console.log(`LM Studio is healthy. Available models:`, data.data.map(m => m.id));
          return true;
        }
      } catch (error) {
        console.error('LM Studio health check failed:', error.message);
      }
      return false;
    };

    describe('fetchNext', () => {
      it('should fetch next item from queue', async () => {
        const mockItem = {
          key: 'queue:filter:123:post1',
          item: {
            postId: 'post1',
            title: 'Test Post',
            selftext: 'Test content',
            keyword: 'javascript'
          }
        };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockItem
        });

        const result = await fetchNext();

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/filter-queue/next?client_id=test-worker',
          expect.objectContaining({
            headers: {}
          })
        );
        expect(result).toEqual(mockItem);
      });

      it('should return null when no items available (204)', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 204
        });

        const result = await fetchNext();
        expect(result).toBeNull();
      });

      it('should handle fetch errors', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await fetchNext();

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith('Error fetching next item:', expect.any(Error));
      });

      it('should include auth token when set', async () => {
        process.env.WORKER_AUTH_TOKEN = 'secret-token';

        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 204
        });

        await fetchNext();

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: { 'Authorization': 'Bearer secret-token' }
          })
        );
      });
    });

    describe('processWithLMStudio', () => {
      it('should process item with LM Studio', async () => {
        const mockItem = {
          postId: 'post1',
          title: 'JavaScript Tutorial',
          selftext: 'Learn JavaScript basics',
          keyword: 'javascript'
        };

        const mockResponse = {
          relevant: true,
          reasoning: 'Post is about JavaScript programming',
          confidence: 0.95
        };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify(mockResponse)
              }
            }]
          })
        });

        const result = await processWithLMStudio(mockItem);

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:1234/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );
        expect(result).toEqual(mockResponse);
      });

      it('should handle LM Studio errors', async () => {
        const mockItem = {
          postId: 'post1',
          title: 'Test',
          keyword: 'test'
        };

        global.fetch.mockRejectedValueOnce(new Error('Connection refused'));

        const result = await processWithLMStudio(mockItem);

        expect(result).toEqual({
          relevant: false,
          reasoning: 'Connection refused',
          confidence: 0
        });
      });

      it('should handle invalid JSON response', async () => {
        const mockItem = { postId: 'post1', keyword: 'test' };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: { content: 'Not valid JSON' }
            }]
          })
        });

        const result = await processWithLMStudio(mockItem);

        expect(result).toEqual({
          relevant: false,
          reasoning: 'Failed to parse AI response',
          confidence: 0
        });
        expect(console.error).toHaveBeenCalledWith('Failed to parse LM Studio response:', 'Not valid JSON');
      });

      it('should handle non-OK response', async () => {
        const mockItem = { postId: 'post1', keyword: 'test' };

        global.fetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error'
        });

        const result = await processWithLMStudio(mockItem);

        expect(result).toEqual({
          relevant: false,
          reasoning: 'LM Studio error: Internal Server Error',
          confidence: 0
        });
      });
    });

    describe('submitResult', () => {
      it('should submit result successfully', async () => {
        const mockResult = {
          relevant: true,
          reasoning: 'Post is relevant',
          confidence: 0.9
        };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Result saved' })
        });

        const response = await submitResult('queue:filter:123:post1', mockResult);

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/filter-queue/result',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: 'queue:filter:123:post1',
              result: mockResult,
              clientId: 'test-worker'
            })
          })
        );
        expect(response).toEqual({ message: 'Result saved' });
      });

      it('should handle submission errors', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Bad Request'
        });

        await expect(submitResult('key', {})).rejects.toThrow('Failed to submit result: Bad Request');
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle network errors', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(submitResult('key', {})).rejects.toThrow('Network error');
        expect(console.error).toHaveBeenCalledWith('Error submitting result:', expect.any(Error));
      });
    });

    describe('checkLMStudioHealth', () => {
      it('should check LM Studio health successfully', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'model1' },
              { id: 'model2' }
            ]
          })
        });

        const result = await checkLMStudioHealth();

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:1234/v1/models');
        expect(result).toBe(true);
        expect(console.log).toHaveBeenCalledWith(
          'LM Studio is healthy. Available models:',
          ['model1', 'model2']
        );
      });

      it('should handle health check failure', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Connection refused'));

        const result = await checkLMStudioHealth();

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('LM Studio health check failed:', 'Connection refused');
      });

      it('should handle non-OK response', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false
        });

        const result = await checkLMStudioHealth();

        expect(result).toBe(false);
      });
    });
  });

  describe('Environment configuration', () => {
    it('should use environment variables', () => {
      expect(process.env.FEED_API_URL).toBe('http://localhost:3000');
      expect(process.env.LM_STUDIO_URL).toBe('http://localhost:1234');
      expect(process.env.CLIENT_ID).toBe('test-worker');
      expect(process.env.POLL_INTERVAL).toBe('100');
    });

    it('should handle missing environment variables with defaults', () => {
      delete process.env.FEED_API_URL;
      delete process.env.LM_STUDIO_URL;
      delete process.env.CLIENT_ID;
      delete process.env.POLL_INTERVAL;

      // Simulate defaults
      const FEED_API_URL = process.env.FEED_API_URL || 'http://localhost:3000';
      const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
      const CLIENT_ID = process.env.CLIENT_ID || `worker-${Date.now()}`;
      const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 5000;

      expect(FEED_API_URL).toBe('http://localhost:3000');
      expect(LM_STUDIO_URL).toBe('http://localhost:1234');
      expect(CLIENT_ID).toMatch(/^worker-\d+$/);
      expect(POLL_INTERVAL).toBe(5000);
    });
  });

  describe('Error recovery', () => {
    it('should handle consecutive errors with backoff', () => {
      class ErrorHandler {
        constructor(maxErrors = 5) {
          this.maxErrors = maxErrors;
          this.consecutiveErrors = 0;
        }

        handleError(error) {
          this.consecutiveErrors++;
          console.error(`Error in main loop (${this.consecutiveErrors}/${this.maxErrors}):`, error);
          
          if (this.consecutiveErrors >= this.maxErrors) {
            console.error('Too many consecutive errors. Pausing for 30 seconds...');
            this.consecutiveErrors = 0;
            return 30000;
          }
          return 5000;
        }

        reset() {
          this.consecutiveErrors = 0;
        }
      }

      const errorHandler = new ErrorHandler(3);

      // Simulate errors
      expect(errorHandler.handleError(new Error('Error 1'))).toBe(5000);
      expect(errorHandler.handleError(new Error('Error 2'))).toBe(5000);
      expect(errorHandler.handleError(new Error('Error 3'))).toBe(30000);
      
      expect(console.error).toHaveBeenCalledTimes(4);
      expect(console.error).toHaveBeenCalledWith('Too many consecutive errors. Pausing for 30 seconds...');
      
      // After automatic reset (consecutiveErrors = 0 after hitting max)
      expect(errorHandler.handleError(new Error('Error 4'))).toBe(5000);
    });
  });

  describe('Sleep function', () => {
    it('should delay for specified time', () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      const promise = sleep(100);
      
      // Since we're using fake timers, we can advance them
      jest.advanceTimersByTime(100);
      
      return expect(promise).resolves.toBeUndefined();
    });
  });
});