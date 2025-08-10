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

### 3. Simplify Storage to Upstash Only ✅
- [x] Remove local file storage implementation  
- [x] Remove standard Redis implementation
- [x] Keep only Upstash Redis support
- [x] Simplify storage.js from 268 lines to 126 lines
- [x] Update all tests to work with simplified implementation

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

### 7. Remove Dead Code
- [ ] Verify and remove `api/debug.js` if unused
- [ ] Verify and remove `api/filter-context-individual.js` if unused
- [ ] Verify and remove `api/clear-filter.js` if unused
- [ ] Verify and remove `lib/llm/response-parser.js` if unused
- [ ] Clean up any other orphaned files

### 8. Improve Environment Handling
- [ ] Remove hardcoded `/tmp` paths for Vercel
- [ ] Separate deployment concerns from business logic
- [ ] Create environment-specific configuration strategies
- [ ] Use dependency injection for environment-specific behavior

### 9. Create HTTP Client Wrapper
- [ ] Create `lib/http-client.js` to wrap https module
- [ ] Move proxy configuration logic into wrapper
- [ ] Simplify Reddit API calls
- [ ] Add retry logic and better error handling

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