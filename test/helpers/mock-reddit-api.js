/**
 * Reddit API mock utilities for tests
 * Provides reusable mock implementations for Reddit API interactions
 */

/**
 * Creates a mock fetch response for Reddit API
 * @param {Object} data - Reddit API response data
 * @param {boolean} ok - Whether the response is successful
 * @param {number} status - HTTP status code
 * @returns {Object} Mock fetch response
 */
function createMockFetchResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data)
  };
}

/**
 * Creates a mock Reddit API response with posts
 * @param {Array} posts - Array of post data
 * @returns {Object} Reddit API response format
 */
function createRedditResponse(posts = []) {
  return {
    data: {
      children: posts.map(post => ({ data: post }))
    }
  };
}

/**
 * Mocks the global fetch function for Reddit API calls
 * @param {Object} response - Response data or error
 * @param {boolean} shouldReject - Whether to reject the promise
 */
function mockGlobalFetch(response, shouldReject = false) {
  if (shouldReject) {
    global.fetch = jest.fn(() => Promise.reject(response));
  } else {
    global.fetch = jest.fn(() => Promise.resolve(response));
  }
}

/**
 * Creates a mock HTTPS request for proxy usage
 * @param {Object} options - Mock options
 * @param {number} options.statusCode - Response status code
 * @param {string} options.statusMessage - Response status message
 * @param {string} options.responseData - Response data
 * @returns {Object} Mock HTTPS request
 */
function createMockHttpsRequest(options = {}) {
  const {
    statusCode = 200,
    statusMessage = 'OK',
    responseData = JSON.stringify({ data: { children: [] } })
  } = options;

  const mockRequest = {
    on: jest.fn(),
    end: jest.fn()
  };

  const mockResponse = {
    statusCode,
    statusMessage,
    on: jest.fn()
  };

  return {
    request: mockRequest,
    response: mockResponse,
    responseData,
    mockHttps: jest.fn((requestOptions, callback) => {
      callback(mockResponse);
      
      // Simulate data event
      const dataHandler = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
      if (dataHandler) {
        dataHandler(responseData);
      }
      
      // Simulate end event
      const endHandler = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
      if (endHandler) {
        endHandler();
      }
      
      return mockRequest;
    })
  };
}

/**
 * Mocks the HTTPS module for proxy requests
 * @param {Object} mockConfig - Mock configuration
 */
function mockHttpsModule(mockConfig = {}) {
  const mockHttps = createMockHttpsRequest(mockConfig);
  
  jest.mock('https', () => ({
    request: mockHttps.mockHttps
  }));

  return mockHttps;
}

/**
 * Mocks the HttpsProxyAgent
 */
function mockHttpsProxyAgent() {
  jest.mock('https-proxy-agent', () => ({
    HttpsProxyAgent: jest.fn()
  }));
}

/**
 * Sets up environment variables for proxy testing
 * @param {Object} options - Proxy configuration
 */
function setupProxyEnvironment(options = {}) {
  const {
    user = 'testuser',
    pass = 'testpass',
    host = 'proxy.example.com:8080',
    vercel = '1'
  } = options;

  const originalEnv = { ...process.env };
  
  process.env.VERCEL = vercel;
  process.env.PROXY_USER = user;
  process.env.PROXY_PASS = pass;
  process.env.PROXY_HOST = host;

  return () => {
    process.env = originalEnv;
  };
}

/**
 * Creates common Reddit API error responses
 */
const REDDIT_ERRORS = {
  rateLimit: createMockFetchResponse(
    { error: 'Too Many Requests' },
    false,
    429
  ),
  forbidden: createMockFetchResponse(
    { error: 'Forbidden' },
    false,
    403
  ),
  serverError: createMockFetchResponse(
    { error: 'Internal Server Error' },
    false,
    500
  ),
  networkError: new Error('Network error')
};

/**
 * Creates a mock fetch implementation that handles different keywords
 * @param {Object} responses - Map of keyword to response data
 * @returns {Function} Mock fetch function
 */
function createKeywordBasedFetch(responses = {}) {
  return jest.fn((url) => {
    // Extract keyword from URL
    const keyword = url.match(/q=([^&]+)/)?.[1];
    const response = responses[keyword] || createRedditResponse([]);
    return Promise.resolve(createMockFetchResponse(response));
  });
}

/**
 * Resets all Reddit API mocks
 */
function resetRedditMocks() {
  jest.clearAllMocks();
  delete global.fetch;
}

module.exports = {
  createMockFetchResponse,
  createRedditResponse,
  mockGlobalFetch,
  createMockHttpsRequest,
  mockHttpsModule,
  mockHttpsProxyAgent,
  setupProxyEnvironment,
  createKeywordBasedFetch,
  resetRedditMocks,
  REDDIT_ERRORS
};