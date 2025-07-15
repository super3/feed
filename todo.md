# Codebase Cleanup & Refactoring Plan

## Phase 1: Remove Unused Code

### High Priority  
- [x] Delete `/api/filter-context.js` (not used by frontend)
- [x] Delete `/api/filter-context-simple.js` (not used by frontend)
- [x] Remove their exclusions from `jest.config.js`
- [x] Delete `/reddit.js` (duplicates functionality, not imported anywhere)
- [x] Remove `cleanResponse` variable in `/api/filter-context-individual.js` (line 124)
- [x] Delete `/api/filter-context.test.js` (test file for removed API)
- [x] Update test assertions to match new error response format

## Phase 2: Extract Common Utilities

### High Priority (Actual Duplication)
- [x] Create `/lib/utils/error-handler.js` (~16 lines duplicated across 6+ files)
  - Method not allowed pattern (in 5 files)
  - 500 error with error.message pattern (in 6 files)
  - 400 error for missing fields pattern (in 3 files)
  - Generic error responses (in 3 files)

### Medium Priority (Code Organization)
- [x] Create `/lib/llm/response-parser.js`
  - Extract YES/NO parsing logic (~90 lines in filter-context-individual.js)
  - Handle truncated responses
  - Parse "Answer: YES/NO" patterns
  - Note: Was duplicated in 3 files before Phase 1, extracting would improve maintainability

### Items Moved to Phase 3 (Not Duplicated)
The following items are not actually duplicated, moved to Phase 3 for optional refactoring:
- CORS middleware (only in filter-context-individual.js)
- HTML cleaner (only in filter-context-individual.js)
- LLM client (only in filter-context-individual.js)

## Phase 3: Refactor Remaining Code

### High Priority
- [x] Update all API files to use error-handler utility
  - `/api/posts.js`
  - `/api/fetch-reddit.js`
  - `/api/clear-filter.js`
  - `/api/keywords.js`
  - `/api/filter-context-individual.js`
  - `/server.js`

### Medium Priority
- [x] Update `/api/filter-context-individual.js` to use extracted utilities
  - Use response parser utility
  - Console.log statements moved to response parser (kept for debugging)

- [ ] Create optional utilities for code organization:
  - CORS middleware (for filter-context-individual.js)
  - HTML cleaner utility (for filter-context-individual.js)
  - LLM client (for filter-context-individual.js)

- [ ] Create storage middleware or base handler
  - Reduce storage initialization boilerplate (used in 7 files)
  - Handle storage errors consistently

### Low Priority
- [ ] Implement proper logging
  - Replace console.log with structured logging
  - Add log levels (debug, info, warn, error)
  - Consider using a logging library like winston or pino

## Phase 4: Code Quality Improvements

### Medium Priority
- [ ] Add comprehensive tests for new utilities
  - Test `/lib/llm/response-parser.js`
  - Test `/lib/utils/error-handler.js`
- [ ] Remove temporary test coverage exclusions from `jest.config.js`

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

## Current Code Duplication Issues (Updated After Phase 1)

### Actual Duplicate Code Still Present
1. **Error Response Patterns** - ~16 lines duplicated across 6+ files
2. **Storage Initialization** - Duplicated in 7 files (minimal but widespread)

### Code Organization Opportunities (Not Duplicated)
1. **CORS Setup** - Only in filter-context-individual.js
2. **HTML Entity Cleaning** - Only in filter-context-individual.js
3. **LLM Configuration & Request** - Only in filter-context-individual.js
4. **YES/NO Response Parsing** - ~90 lines in filter-context-individual.js (was duplicated before Phase 1)

### Completed in Phase 1
- ✅ Deleted `/api/filter-context.js` (unused)
- ✅ Deleted `/api/filter-context-simple.js` (unused)
- ✅ Deleted `/reddit.js` (unused)
- ✅ Removed `cleanResponse` variable
- ✅ Deleted associated test file

### Still TODO
- Multiple TODO comments in `/lib/storage.js` for unimplemented Vercel KV
- `/lib/utils/error-handler.js` and `/lib/llm/response-parser.js` excluded from coverage (need tests)

## Implementation Notes

- Start with Phase 1 (removing unused code) as it's low risk and high impact
- Focus on extracting the response parser next as it's the largest duplication
- Test each refactoring step to ensure no regressions
- Consider keeping the old filter APIs temporarily if needed for rollback