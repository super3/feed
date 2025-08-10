const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const appConfig = require('./config');
const logger = require('./logger');

class HttpClient {
  constructor(options = {}) {
    this.defaultTimeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.userAgent = options.userAgent || appConfig.reddit.userAgent;
  }

  /**
   * Get proxy agent if needed
   * @returns {HttpsProxyAgent|null} Proxy agent or null
   */
  getProxyAgent() {
    const isVercel = appConfig.environment.isVercel;
    const hasProxyAuth = appConfig.proxy.hasAuth;

    if (isVercel && hasProxyAuth) {
      const proxyUrl = appConfig.proxy.url;
      logger.debug('Using proxy for HTTP request', { proxyHost: appConfig.proxy.host });
      return new HttpsProxyAgent(proxyUrl);
    }

    return null;
  }

  /**
   * Make an HTTP request with retry logic
   * @param {string} url - URL to request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async request(url, options = {}) {
    const requestOptions = {
      headers: {
        'User-Agent': this.userAgent,
        ...options.headers
      },
      timeout: options.timeout || this.defaultTimeout
    };

    // Add proxy if needed
    const proxyAgent = this.getProxyAgent();
    if (proxyAgent) {
      requestOptions.agent = proxyAgent;
    }

    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug('Making HTTP request', { url, attempt, maxRetries: this.maxRetries });
        
        const response = await this.fetchWithTimeout(url, requestOptions);
        
        if (!response.ok) {
          // Check for rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelay * attempt;
            logger.warn('Rate limited, retrying', { status: response.status, delay, attempt });
            
            if (attempt < this.maxRetries) {
              await this.delay(delay);
              continue;
            }
          }
          
          // For other errors, throw to trigger retry
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Success
        const data = await response.json();
        logger.debug('HTTP request successful', { url, attempt });
        return data;
        
      } catch (error) {
        lastError = error;
        logger.error('HTTP request failed', { 
          url, 
          attempt, 
          error: error.message,
          willRetry: attempt < this.maxRetries 
        });

        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted
    throw new Error(`HTTP request failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Fetch with timeout
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Response object
   */
  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reddit-specific request method
   * @param {string} endpoint - Reddit API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Reddit API response
   */
  async redditRequest(endpoint, params = {}, options = {}) {
    // Build URL with query parameters
    const url = new URL(endpoint);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    // Make request with Reddit-specific handling
    try {
      const data = await this.request(url.toString(), options);
      
      // Check for Reddit API errors
      if (data.error) {
        throw new Error(`Reddit API error: ${data.error}`);
      }

      return data;
    } catch (error) {
      // Enhanced error for Reddit API
      if (error.message.includes('403')) {
        throw new Error('Reddit API access denied. Proxy may be required.');
      }
      if (error.message.includes('429')) {
        throw new Error('Reddit API rate limit exceeded. Please wait before retrying.');
      }
      throw error;
    }
  }
}

// Singleton instance
let httpClientInstance;

/**
 * Get HTTP client instance
 * @param {Object} options - Client options
 * @returns {HttpClient} HTTP client instance
 */
function getHttpClient(options) {
  if (!httpClientInstance) {
    httpClientInstance = new HttpClient(options);
  }
  return httpClientInstance;
}

/**
 * Reset HTTP client instance (for testing)
 */
function resetHttpClient() {
  httpClientInstance = null;
}

module.exports = {
  HttpClient,
  getHttpClient,
  resetHttpClient
};