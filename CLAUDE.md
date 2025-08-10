# Claude Code Guidelines for Reddit Feed Project

## 🔴 QUICK REFERENCE - MUST FOLLOW 🔴
```bash
# Before marking ANY task complete:
npm test  # MUST show 0 failures

# Task is NOT complete until:
✅ Code written
✅ Code integrated  
✅ Tests pass (ALL of them)
✅ Coverage met
```

## Project Overview
Reddit Feed Aggregator that fetches posts by keyword with web interface. Uses Redis/Upstash for persistent storage on Vercel deployment.

## Key Technical Details
- **Storage**: Upstash Redis (REDIS_URL or KV_URL env vars) for Vercel, local file storage for development
- **Proxy**: ProxyMesh credentials for Reddit API access (PROXY_USER, PROXY_PASS, PROXY_HOST)
- **Cron Jobs**: Use external service (e.g., cron-job.org) to call `/api/cron/fetch-posts` or `/api/fetch-reddit`

## Important Guidelines

### Testing - MANDATORY WORKFLOW
⚠️ **CRITICAL: Tests MUST pass before marking ANY task as complete** ⚠️

1. **BEFORE starting work**: Run `npm test` to understand current state
2. **DURING development**: Run tests frequently to catch issues early
3. **BEFORE marking task complete**: Run `npm test` - ALL tests MUST pass
4. **BEFORE committing**: Run `npm test` to verify your changes
5. **Definition of "Complete"**: A task is ONLY complete when:
   - Code is written
   - Code is integrated
   - ALL tests pass (npm test shows 0 failures)
   - Coverage thresholds are met: 78% branches, 80% functions/lines/statements

**Never mark a task as complete in TODO.md without confirming all tests pass!**

### Git Workflow
- **NEVER commit or push without explicit user permission**
- **ALWAYS run tests before committing** - no exceptions
- If tests fail after your changes, either:
  1. Fix the broken functionality, OR
  2. Update the tests to match new expected behavior
- Use descriptive commit messages explaining what changed and why

### Code Standards
- No unnecessary comments unless specifically requested
- Follow existing code patterns and conventions
- Use existing libraries - don't assume new ones are available
- Check package.json before using any library
- **When changing core behavior** (like error messages, API responses):
  - Consider impact on existing tests
  - Update affected tests as part of the task
  - Run tests to verify compatibility

### Environment Variables
Required for Vercel deployment:
- `REDIS_URL` or `KV_URL`: Upstash Redis connection URL
- `PROXY_USER`, `PROXY_PASS`, `PROXY_HOST`: ProxyMesh credentials
- `CRON_SECRET` (optional): Security token for cron job authentication

### Common Commands
- `npm run dev`: Start local development server
- `npm test`: Run all tests
- `npm run test:coverage`: Run tests with coverage report
- `vercel`: Deploy to Vercel
- `vercel env pull`: Pull environment variables from Vercel

### Storage Behavior
- On Vercel: Uses Upstash Redis for persistence
- Locally: Uses file storage in `/data` directory
- Storage auto-detects based on environment variables

### Debugging Tips
- Check storage type with console logs in storage.js
- Reddit API may return 403/429 errors without proxy
- Posts are stored with timestamp keys: `posts:${keyword}:${timestamp}`
- Keywords stored in `config:keywords` key

### Known Issues
- Posts disappear on Vercel without proper Upstash configuration
- Reddit blocks requests without proxy from most IPs
- Test isolation issues with Jest mocks in cron tests

### Coverage Status
**Current Status**: ✅ All coverage thresholds met!
- Branch coverage: 88.92% (threshold: 78%)
- Statement coverage: 96.12% (threshold: 80%)
- Function coverage: 92.85% (threshold: 80%)
- Line coverage: 96.26% (threshold: 80%)

**How to maintain coverage:**
1. Run `npm run test:coverage` before committing
2. Add tests for new code to maintain high coverage
3. Remaining uncovered areas (minor):
   - `lib/reddit-client.js` - Lines 46-58 (HTTP client fallback path)
   - Some error handling edge cases

**When it's OK to commit with lower coverage:**
- If you're fixing a critical bug
- If the uncovered code is error handling that's hard to test
- If you're removing code (which can temporarily lower percentage)
- Document the reason in your commit message

**Quick fix for current coverage:**
```bash
# The http-client.js and storage.js need more error path testing
# Focus on testing error conditions and edge cases
```

## File Structure
```
/api
  /cron
    fetch-posts.js      # Automated cron job endpoint
  fetch-reddit.js       # Manual Reddit fetch endpoint
  keywords.js           # Keyword management API
  posts.js             # Posts retrieval API
/lib
  storage.js           # Storage abstraction layer
/public
  index.html           # Web interface
```

## Deployment Checklist
1. Ensure Upstash Redis is configured with proper URLs
2. Verify proxy credentials are set
3. Test storage persistence after deployment
4. Set up external cron service (cron-job.org) to call endpoints
5. Configure CRON_SECRET if using authentication for cron endpoint