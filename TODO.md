# Reddit Feed Codebase Refactoring Plan

## High Priority

### 1. Eliminate Code Duplication ✅
- [x] Extract duplicate `fetchRedditPosts` function from `api/fetch-reddit.js` and `api/cron/fetch-posts.js`
- [x] Create `lib/reddit-client.js` to centralize Reddit API interactions
- [x] Remove 100+ lines of duplicated code
- [x] Update all tests to match new response format
- [x] Verify all tests pass (90/90 passing)

### 2. Create Configuration Module ✅
- [x] Create `lib/config.js` to centralize all configuration
- [x] Move all environment variables to single location
- [x] Include: Redis/Upstash settings, proxy configuration, API endpoints, default values
- [x] Remove scattered `process.env` calls throughout codebase
- [x] Make configuration dynamic for testing (getters for env vars)
- [x] All tests passing (90/90)

### 3. Refactor Storage with Hybrid Approach ✅
- [x] Remove standard Redis implementation (non-Upstash)
- [x] Keep Upstash Redis as primary storage for production
- [x] Restore local file storage as fallback for development environments
- [x] Implement automatic detection: use Upstash when credentials available, fallback to local otherwise
- [x] Update storage.js to support both modes (227 lines with fallback logic)
- [x] Fix production regression where app broke without Upstash credentials
- [x] Update all tests to validate fallback behavior

## Medium Priority

### 4. Implement Proper Logging ✅
- [x] Replace excessive console.log statements with proper logging
- [x] Implement logging library (winston or pino)
- [x] Add log levels: debug, info, warn, error
- [x] Clean up test output noise

### 5. Consolidate Test Utilities ✅
- [x] Create `test/helpers/` directory
- [x] Extract `test/helpers/mock-storage.js` for storage mocks
- [x] Extract `test/helpers/mock-reddit-api.js` for API mocks
- [x] Extract `test/helpers/test-fixtures.js` for test data
- [x] Remove duplicated test setup code

### 6. Standardize API Responses ✅
- [x] Enhance `lib/utils/error-handler.js`
- [x] Create consistent response format for all endpoints
- [x] Implement proper HTTP status codes
- [x] Add request validation middleware

## Low Priority

### 7. Remove Dead Code ✅
- [x] Verified and removed `api/debug.js` (unused debugging endpoint)
- [x] Verified `api/filter-context-individual.js` is actively used (AI filtering feature)
- [x] Verified `api/clear-filter.js` is actively used (clears AI filter data)
- [x] Verified `lib/llm/response-parser.js` is actively used (parses LLM responses)
- [x] No other orphaned files found

### 8. Improve Environment Handling ✅
- [x] Removed hardcoded `/tmp` paths - now configurable via VERCEL_DATA_DIR env var
- [x] Separated deployment concerns with environment strategies
- [x] Created environment-specific configuration strategies (vercel, development, production, test)
- [x] Added environment-specific settings (logLevel, maxWorkers, dataDir)
- [x] Made configuration injectable and testable

### 9. Create HTTP Client Wrapper ✅
- [x] Created `lib/http-client.js` with full HTTP client implementation
- [x] Moved proxy configuration logic into wrapper (automatic proxy detection)
- [x] Simplified Reddit API calls with `redditRequest` method
- [x] Added retry logic with exponential backoff (3 retries by default)
- [x] Added timeout handling and rate limit detection
- [x] Implemented singleton pattern for efficient resource usage

### 10. Add Type Safety and Documentation
- [ ] Add JSDoc comments to all functions
- [ ] Document expected parameter types and return values
- [ ] Consider migrating to TypeScript for better type safety
- [ ] Generate API documentation from JSDoc

## Expected Benefits

- **Code Reduction**: ~30% less code through deduplication
- **Maintainability**: Clear separation of concerns
- **Testability**: Easier to mock and test individual components
- **Performance**: Better error handling and resource management
- **Developer Experience**: Cleaner logs, better documentation

## Implementation Order

1. Start with code duplication (biggest immediate win)
2. Configuration module (simplifies everything else)
3. Storage refactoring (improves testability)
4. Logging (improves debugging)
5. Test consolidation (reduces test maintenance)
6. Continue with remaining items based on need