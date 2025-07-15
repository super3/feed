# Codebase Cleanup & Refactoring Plan

## Phase 1: Remove Unused Code

### High Priority
- [x] Delete `/api/filter-context.js` (not used by frontend)
- [x] Delete `/api/filter-context-simple.js` (not used by frontend)
- [x] Remove their exclusions from `jest.config.js`
- [x] Delete `/reddit.js` (duplicates functionality, not imported anywhere)
- [x] Remove `cleanResponse` variable in `/api/filter-context-individual.js` (line 124)
- [x] Delete `/api/filter-context.test.js` (test file for removed API)

## Phase 2: Extract Common Utilities

### High Priority
- [ ] Create `/lib/llm/response-parser.js`
  - Extract YES/NO parsing logic (~90 lines of duplicate code)
  - Handle truncated responses
  - Parse "Answer: YES/NO" patterns

### Medium Priority
- [ ] Create `/lib/middleware/cors.js`
  - Extract CORS headers setup
  - Handle OPTIONS preflight requests
  - Apply to all API endpoints

- [ ] Create `/lib/utils/html-cleaner.js`
  - Extract HTML entity cleaning logic
  - Add configurable length limit

- [ ] Create `/lib/llm/client.js`
  - LM Studio configuration
  - Request timeout handling
  - Error handling with retry logic

- [ ] Create `/lib/utils/error-handler.js`
  - Standardized error responses
  - LM Studio-specific error messages
  - Logging integration

## Phase 3: Refactor Remaining Code

### Medium Priority
- [ ] Update `/api/filter-context-individual.js` to use extracted utilities
  - Use new CORS middleware
  - Use HTML cleaner utility
  - Use LLM client and response parser
  - Use error handler utility
  - Remove console.log statements (lines 118, 137, 145, 155)

- [ ] Create storage middleware or base handler
  - Reduce storage initialization boilerplate
  - Handle storage errors consistently

### Low Priority
- [ ] Implement proper logging
  - Replace console.log with structured logging
  - Add log levels (debug, info, warn, error)
  - Consider using a logging library like winston or pino

## Phase 4: Code Quality Improvements

### Medium Priority
- [ ] Add comprehensive tests for new utilities
  - Test response-parser.js
  - Test html-cleaner.js
  - Test error-handler.js
  - Test CORS middleware

- [ ] Add tests for `/api/filter-context-individual.js`
- [ ] Remove test coverage exclusions from `jest.config.js`
- [ ] Achieve >80% coverage without exclusions

### Low Priority
- [ ] Add JSDoc comments
  - Document all public APIs
  - Document utility functions
  - Add usage examples

- [ ] Consider TypeScript migration
  - Add type definitions
  - Improve IDE support
  - Catch errors at compile time

## Phase 5: Performance Optimizations

### Low Priority
- [ ] Optimize frontend-backend communication
  - Consider batch filtering instead of individual calls
  - Implement request debouncing
  - Add caching layer

- [ ] Optimize storage operations
  - Batch storage updates
  - Implement connection pooling
  - Add caching for frequently accessed data

## Current Code Duplication Issues

### Duplicate Code Blocks
1. **CORS Setup** - Duplicated in 3 files
2. **HTML Entity Cleaning** - Duplicated in 3 files  
3. **LLM Prompt Construction** - Duplicated in 3 files
4. **YES/NO Response Parsing** - ~90 lines duplicated in 3 files
5. **LM Studio Configuration** - Duplicated in 3 files
6. **Storage Initialization** - Duplicated in 7 files
7. **Error Response Pattern** - Duplicated across multiple files

### Unused Code
- `/api/filter-context.js` - Entire file unused
- `/api/filter-context-simple.js` - Entire file unused
- `/reddit.js` - Entire file unused
- `cleanResponse` variable - Defined but never used
- `failedRequests` variable - Incremented but never used
- Multiple TODO comments in `/lib/storage.js` for unimplemented Vercel KV

## Implementation Notes

- Start with Phase 1 (removing unused code) as it's low risk and high impact
- Focus on extracting the response parser next as it's the largest duplication
- Test each refactoring step to ensure no regressions
- Consider keeping the old filter APIs temporarily if needed for rollback