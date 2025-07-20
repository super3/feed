module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.js',
    'api/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!api/filter-context-individual.js',
    '!api/clear-filter.js',
    '!api/debug.js',
    '!lib/utils/error-handler.js',
    '!lib/llm/response-parser.js'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  modulePathIgnorePatterns: ['<rootDir>/data/']
};