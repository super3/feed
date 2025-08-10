# Vercel Deployment Plan for Reddit Feed

## Project Setup Checklist

### 1. Prepare Project Structure
- [x] Create `/api` directory for serverless functions
- [x] Create `/public` directory for frontend files
- [x] Move `reddit.js` logic into serverless function format

### 2. Local Development Setup
- [x] Create initial serverless function structure
- [x] Set up local storage abstraction layer:
  - [x] Create `lib/storage.js` with interface for get/set/delete
  - [x] Implement local JSON file storage for development
  - [x] Design to easily swap to Vercel KV later
- [x] Convert `reddit.js` to work with storage abstraction
- [x] Create basic Express server for local testing:
  - [x] `server.js` to simulate Vercel's serverless environment
  - [x] Mount API routes at `/api/*`
  - [x] Serve static files from `/public`
- [x] Test core functionality with Jest:
  - [x] Create jest.config.js
  - [x] Test storage abstraction layer
  - [x] Test API endpoints with mocked Reddit responses
  - [x] Test keyword management
  - [x] Run test suite and verify coverage

### 3. Create Serverless Functions
- [x] `/api/fetch-reddit.js` - Convert reddit.js to serverless function
  - [x] Remove direct file system operations
  - [x] Use storage abstraction layer
  - [x] Return JSON response instead of console output
- [x] `/api/posts.js` - Endpoint to retrieve stored posts
  - [x] Use storage abstraction layer
  - [x] Return posts sorted by date
  - [ ] Add pagination support (optional)
  - [x] Accept `?keyword=` query parameter to filter posts
  - [x] Return all posts if no keyword specified
  - [x] Store posts with keyword metadata

### 4. Set Up Storage (Redis via Upstash)
- [x] Enable Upstash Redis in Vercel dashboard (or other Redis provider)
- [x] Install `@upstash/redis` package
- [x] Create Redis instance
- [x] Update code to use Redis instead of JSON files:
  - [x] Store posted IDs in Redis set per keyword: `posted:${keyword}:${postId}`
  - [x] Store post data with keyword prefix: `posts:${keyword}:${timestamp}`
  - [x] Store keyword configuration: `config:keywords` (array)
- [x] Data structure:
  - [x] Each post includes the keyword it was fetched for
  - [x] Posts can appear under multiple keywords if matched
  - [x] Maintain separate posted ID sets per keyword
- [x] Create keyword management:
  - [x] `/api/keywords.js` - GET/POST/DELETE keywords
  - [x] Default keywords if none configured
  - [x] UI for managing keywords in frontend

### 5. Create Frontend
- [x] `/public/index.html` - Main page
  - [x] Simple, clean design
  - [x] Fetch data from `/api/posts`
  - [x] Display posts in cards/list format
  - [x] Add keyword management section
  - [x] Keyword filter/tabs to view posts by keyword
- [x] `/public/style.css` - Basic styling
- [x] `/public/script.js` - Frontend JavaScript
  - [x] Fetch posts on load
  - [x] Add manual refresh button
  - [x] Show loading states
  - [x] Keyword management (add/remove/list)
  - [x] Save keywords via `/api/keywords`
  - [x] Filter posts by keyword using tabs or dropdown
  - [x] Update URL params when filtering (e.g., `?keyword=javascript`)

### 6. Configure Vercel
- [x] External cron setup (using cron-job.org instead of Vercel cron):
  - [x] Set up cron-job.org to call `/api/cron/fetch-posts` every 10 minutes
  - [x] No vercel.json needed for cron configuration
- [ ] Create `vercel.json` (if needed for other configs):
  - [ ] Set Node.js version to 22
  - [ ] Configure redirects if needed
- [x] Update `package.json`:
  - [x] Add `@upstash/redis` dependency
  - [x] Add `express` for local development
  - [x] Remove `node-fetch` (native fetch in Node 22)
  - [x] Update scripts for Vercel
  - [x] Add `"dev": "node server.js"` script for local testing

### 7. AI Filtering Queue System
Since LM Studio runs on a separate server, we'll implement a queue-based system for asynchronous AI filtering:

**Queue Architecture:**
- [x] Create `/api/filter-queue.js` endpoints:
  - [x] POST `/api/filter-queue/add` - Add posts to filter queue
  - [x] GET `/api/filter-queue/next` - Get next unprocessed item
  - [x] POST `/api/filter-queue/result` - Submit filtering result
  - [x] GET `/api/filter-queue/status` - Check queue status
  - [x] POST `/api/filter-queue/cleanup` - Clean up old completed items
  - [x] POST `/api/filter-queue/reset-stuck` - Reset stuck processing items

**Storage Structure:**
- [x] Queue items: `queue:filter:${timestamp}:${postId}`
- [x] Processing items: `queue:processing:${clientId}:${postId}`
- [x] Results: `queue:results:${postId}`
- [x] Queue metadata: `queue:stats` (total, pending, processed)

**Client Worker (`filter-client.js`):**
- [x] Standalone Node.js script that runs on LM Studio server
- [x] Configuration via environment variables:
  - [x] `FEED_API_URL` - URL of the Reddit Feed server
  - [x] `LM_STUDIO_URL` - Local LM Studio URL (default: localhost:1234)
  - [x] `CLIENT_ID` - Unique identifier for this worker
  - [x] `POLL_INTERVAL` - How often to check for new items (default: 5s)
  - [x] `WORKER_AUTH_TOKEN` - Optional authentication token
- [x] Main loop:
  1. Poll `/api/filter-queue/next` for work
  2. If item found, call LM Studio for filtering
  3. POST result back to `/api/filter-queue/result`
  4. Handle errors and retries
  5. Sleep for POLL_INTERVAL

**API Updates:**
- [x] Update filter-context.js to queue items instead of direct filtering
- [x] Add queue management UI to show filtering progress
- [x] Store partial results as items are processed
- [x] Add timeout handling for stuck items

**Implementation Steps:**
1. [x] Create queue API endpoints
2. [x] Update frontend to show "Queued for filtering" status
3. [x] Create filter-client.js worker script
4. [x] Add deployment instructions for worker
5. [x] Test with multiple concurrent workers

**Worker Deployment Instructions:**
To deploy the filter-client.js worker on your LM Studio server:

1. Copy `filter-client.js` to your LM Studio server
2. Set environment variables:
   ```bash
   export FEED_API_URL="https://your-reddit-feed.vercel.app"
   export LM_STUDIO_URL="http://localhost:1234"
   export CLIENT_ID="worker-1"
   export POLL_INTERVAL="5000"
   # Optional: export WORKER_AUTH_TOKEN="your-secret-token"
   ```
3. Run the worker:
   ```bash
   node filter-client.js
   ```
4. For production, use PM2 or systemd:
   ```bash
   # With PM2
   pm2 start filter-client.js --name "reddit-filter-worker"
   pm2 save
   pm2 startup
   ```

### 8. Environment Variables
- [x] Set up in Vercel dashboard:
  - [x] `UPSTASH_REDIS_REST_URL` - Redis URL from Upstash
  - [x] `UPSTASH_REDIS_REST_TOKEN` - Redis token from Upstash
  - [x] `QUEUE_TIMEOUT` - Max time for processing (default: 300s)
  - [x] `WORKER_AUTH_TOKEN` - Optional auth token for worker clients

### 9. Testing with Jest
- [x] Install Jest and testing dependencies:
  - [x] `jest` and `@types/jest`
  - [x] `node-mocks-http` for API testing
  - [x] `@upstash/redis` mock setup
- [x] Create test files:
  - [x] `/api/fetch-reddit.test.js` - Test Reddit fetching logic
    - [x] Mock fetch calls to Reddit API
    - [x] Test duplicate detection
    - [x] Test error handling
  - [x] `/api/posts.test.js` - Test posts retrieval
    - [x] Mock KV storage responses
    - [ ] Test pagination (pending implementation)
    - [x] Test empty state
  - [x] `/api/keywords.test.js` - Test keyword management
    - [x] Test GET/POST/DELETE operations
    - [x] Test duplicate prevention
    - [x] Test error handling
- [x] Add test scripts to `package.json`:
  - [x] `"test": "jest"`
  - [x] `"test:watch": "jest --watch"`
  - [x] `"test:coverage": "jest --coverage"`
- [x] Configure `jest.config.js`:
  - [x] Set test environment to `node`
  - [x] Configure coverage thresholds
  - [x] Set up module mocks
- [x] Run tests before each deployment
- [x] Aim for >80% code coverage (achieved 100% statements, 91% branches)

### 10. Final Vercel Integration
- [x] Install Vercel CLI: `npm i -g vercel`
- [x] Run `vercel dev` to test locally
- [x] Test all endpoints
- [x] Verify Redis storage works
- [x] Run Jest tests: `npm test`

### 11. Deployment
- [x] Connect GitHub repo to Vercel
- [x] Deploy with `vercel --prod`
- [x] Verify cron job runs (via cron-job.org)
- [x] Test live endpoints
- [x] Monitor logs for errors

### 12. Additional Features Implemented
- [x] AI-powered context filtering with LM Studio integration
- [x] Keyword context support (e.g., "apple notes" as "the note-taking app")
- [x] Progressive filtering UI with real-time status updates
- [x] GitHub Actions workflow with test automation
- [x] Coveralls integration for coverage reporting
- [x] Clear filter functionality
- [x] Improved UI with better button placement and styling
- [x] Error handling for LM Studio connection issues

### 13. Optional Enhancements
- [ ] Add search/filter functionality within posts
- [ ] Implement webhook for real-time updates
- [ ] Add RSS feed endpoint
- [ ] Create admin endpoint to manually trigger fetches
- [ ] Add analytics to track popular keywords
- [ ] Add pagination support for posts endpoint
- [ ] Extend time range for Reddit fetching (currently 1 hour)

## File Structure After Implementation
```
/.github/workflows
  test.yml
/api
  clear-filter.js
  /cron
    fetch-posts.js
    fetch-posts.test.js
  fetch-reddit.js
  fetch-reddit.test.js
  filter-context-individual.js
  filter-queue.js
  keywords.js
  keywords.test.js
  posts.js
  posts.test.js
/lib
  config.js
  config.test.js
  http-client.js
  http-client.test.js
  logger.js
  logger.test.js
  reddit-client.js
  storage.js
  storage.test.js
  storage-local.test.js
  /llm
    response-parser.js
  /test/helpers
    index.js
    mock-reddit-api.js
    mock-storage.js
    test-fixtures.js
  /utils
    error-handler.js
/public
  favicon.svg
  index.html
  script.js
  style.css
filter-client.js (runs on LM Studio server)
server.js (for local development)
jest.config.js
package.json
plan.md
README.md
.gitignore
```

## Notes
- Upstash Redis free tier: 10,000 requests/day, 256MB storage
- Cron jobs run in UTC timezone
- Cron syntax for every 10 minutes: `*/10 * * * *`
- Serverless functions have 10-second timeout (default)
- Consider rate limiting to prevent abuse
- 144 fetches per day (every 10 min) is well within Reddit's limits