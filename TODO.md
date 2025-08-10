# Reddit Feed Codebase Refactoring Plan

## High Priority

### 1. Eliminate Code Duplication ✅
- [x] Extract duplicate `fetchRedditPosts` function from `api/fetch-reddit.js` and `api/cron/fetch-posts.js`
- [x] Create `lib/reddit-client.js` to centralize Reddit API interactions
- [x] Remove 100+ lines of duplicated code
- [x] Update all tests to match new response format
- [x] Verify all tests pass (90/90 passing)

### 2. Create Configuration Module
- [ ] Create `lib/config.js` to centralize all configuration
- [ ] Move all environment variables to single location
- [ ] Include: Redis/Upstash settings, proxy configuration, API endpoints, default values
- [ ] Remove scattered `process.env` calls throughout codebase

### 3. Refactor Storage with Strategy Pattern
- [ ] Split `lib/storage.js` (currently 95+ lines handling 3 Redis implementations)
- [ ] Create `lib/storage/index.js` - main interface
- [ ] Create `lib/storage/local.js` - file storage implementation
- [ ] Create `lib/storage/upstash.js` - Upstash Redis implementation
- [ ] Create `lib/storage/redis.js` - standard Redis implementation

## Medium Priority

### 4. Implement Proper Logging
- [ ] Replace excessive console.log statements with proper logging
- [ ] Implement logging library (winston or pino)
- [ ] Add log levels: debug, info, warn, error
- [ ] Clean up test output noise

### 5. Consolidate Test Utilities
- [ ] Create `test/helpers/` directory
- [ ] Extract `test/helpers/mock-storage.js` for storage mocks
- [ ] Extract `test/helpers/mock-reddit-api.js` for API mocks
- [ ] Extract `test/helpers/test-fixtures.js` for test data
- [ ] Remove duplicated test setup code

### 6. Standardize API Responses
- [ ] Enhance `lib/utils/error-handler.js`
- [ ] Create consistent response format for all endpoints
- [ ] Implement proper HTTP status codes
- [ ] Add request validation middleware

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