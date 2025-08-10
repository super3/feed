/**
 * Storage mock utilities for tests
 * Provides reusable mock implementations for storage layer testing
 */

/**
 * Creates a mock storage instance with all required methods
 * @param {Object} overrides - Optional method overrides
 * @returns {Object} Mock storage instance
 */
function createMockStorage(overrides = {}) {
  const mockStorage = {
    init: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    delete: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    sismember: jest.fn().mockResolvedValue(0),
    ...overrides
  };

  return mockStorage;
}

/**
 * Mocks the storage module to return a specific mock instance
 * @param {Object} mockStorage - The mock storage instance to return
 */
function mockStorageModule(mockStorage) {
  jest.mock('../../lib/storage', () => ({
    getStorage: jest.fn(() => mockStorage),
    resetStorage: jest.fn()
  }));
}

/**
 * Creates and sets up a mock storage with common test patterns
 * @param {Object} options - Configuration options
 * @param {Array} options.keywords - Mock keywords to return
 * @param {Array} options.postKeys - Mock post keys to return
 * @param {Object} options.posts - Mock posts data by key
 * @returns {Object} Configured mock storage instance
 */
function setupMockStorage(options = {}) {
  const {
    keywords = null,
    postKeys = [],
    posts = {},
    overrides = {}
  } = options;

  const mockStorage = createMockStorage({
    get: jest.fn().mockImplementation((key) => {
      if (key === 'config:keywords') {
        return Promise.resolve(keywords);
      }
      if (posts[key]) {
        return Promise.resolve(posts[key]);
      }
      return Promise.resolve(null);
    }),
    keys: jest.fn().mockImplementation((pattern) => {
      if (pattern && pattern.includes('posts:')) {
        return Promise.resolve(postKeys);
      }
      return Promise.resolve([]);
    }),
    ...overrides
  });

  return mockStorage;
}

/**
 * Mock Redis instance for Upstash testing
 */
const createMockRedisInstance = (overrides = {}) => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  sadd: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  sismember: jest.fn().mockResolvedValue(0),
  keys: jest.fn().mockResolvedValue([]),
  ...overrides
});

/**
 * Sets up Upstash Redis mock
 * @param {Object} mockRedisInstance - Mock Redis instance
 */
function mockUpstashRedis(mockRedisInstance) {
  jest.mock('@upstash/redis', () => ({
    Redis: jest.fn().mockImplementation(() => mockRedisInstance)
  }));
}

/**
 * Resets all storage mocks
 */
function resetStorageMocks() {
  jest.clearAllMocks();
}

/**
 * Common test data patterns for storage
 */
const STORAGE_TEST_DATA = {
  keywords: {
    simple: ['javascript', 'react', 'nodejs'],
    object: [
      { keyword: 'javascript', context: 'programming' },
      { keyword: 'react', context: 'frontend' }
    ],
    mixed: [
      'javascript',
      { keyword: 'react', context: 'frontend' },
      'nodejs'
    ]
  },
  posts: {
    javascript: {
      timestamp: 1704067200000,
      keyword: 'javascript',
      posts: [{
        id: 'post1',
        title: 'JavaScript Tips',
        author: 'user1',
        permalink: '/r/javascript/comments/post1',
        created_utc: 1704067200,
        score: 42,
        num_comments: 10,
        subreddit_name_prefixed: 'r/javascript',
        selftext: 'This is the post content'
      }]
    },
    react: {
      timestamp: 1704067300000,
      keyword: 'react',
      posts: [{
        id: 'post2',
        title: 'React Hooks Guide',
        author: 'user2',
        permalink: '/r/react/comments/post2',
        created_utc: 1704067300,
        score: 15,
        num_comments: 5,
        subreddit_name_prefixed: 'r/react',
        selftext: 'React hooks tutorial'
      }]
    }
  }
};

module.exports = {
  createMockStorage,
  mockStorageModule,
  setupMockStorage,
  createMockRedisInstance,
  mockUpstashRedis,
  resetStorageMocks,
  STORAGE_TEST_DATA
};