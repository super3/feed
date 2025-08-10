/**
 * Test helpers index - exports all test utilities
 */

const mockStorage = require('./mock-storage');
const mockRedditApi = require('./mock-reddit-api');
const testFixtures = require('./test-fixtures');

module.exports = {
  ...mockStorage,
  ...mockRedditApi,
  ...testFixtures
};