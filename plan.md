# Vercel Deployment Plan for Reddit Feed

## Project Setup Checklist

### 1. Prepare Project Structure
- [ ] Create `/api` directory for serverless functions
- [ ] Create `/public` directory for frontend files
- [ ] Move `reddit.js` logic into serverless function format

### 2. Local Development Setup
- [ ] Create initial serverless function structure
- [ ] Set up local storage abstraction layer:
  - [ ] Create `lib/storage.js` with interface for get/set/delete
  - [ ] Implement local JSON file storage for development
  - [ ] Design to easily swap to Vercel KV later
- [ ] Convert `reddit.js` to work with storage abstraction
- [ ] Create basic Express server for local testing:
  - [ ] `server.js` to simulate Vercel's serverless environment
  - [ ] Mount API routes at `/api/*`
  - [ ] Serve static files from `/public`
- [ ] Test core functionality locally:
  - [ ] Fetching Reddit posts
  - [ ] Storing/retrieving posts
  - [ ] Keyword filtering
  - [ ] Basic frontend display

### 3. Create Serverless Functions
- [ ] `/api/fetch-reddit.js` - Convert reddit.js to serverless function
  - [ ] Remove direct file system operations
  - [ ] Use storage abstraction layer
  - [ ] Return JSON response instead of console output
- [ ] `/api/posts.js` - Endpoint to retrieve stored posts
  - [ ] Use storage abstraction layer
  - [ ] Return posts sorted by date
  - [ ] Add pagination support (optional)
  - [ ] Accept `?keyword=` query parameter to filter posts
  - [ ] Return all posts if no keyword specified
  - [ ] Store posts with keyword metadata

### 4. Set Up Storage (Vercel KV)
- [ ] Enable Vercel KV in Vercel dashboard
- [ ] Install `@vercel/kv` package
- [ ] Create KV instance
- [ ] Update code to use KV instead of JSON files:
  - [ ] Store posted IDs in KV set per keyword: `posted:${keyword}:${postId}`
  - [ ] Store post data with keyword prefix: `posts:${keyword}:${timestamp}`
  - [ ] Store keyword configuration: `config:keywords` (array)
- [ ] Data structure:
  - [ ] Each post includes the keyword it was fetched for
  - [ ] Posts can appear under multiple keywords if matched
  - [ ] Maintain separate posted ID sets per keyword
- [ ] Create keyword management:
  - [ ] `/api/keywords.js` - GET/POST/DELETE keywords
  - [ ] Default keywords if none configured
  - [ ] UI for managing keywords in frontend

### 5. Create Frontend
- [ ] `/public/index.html` - Main page
  - [ ] Simple, clean design
  - [ ] Fetch data from `/api/posts`
  - [ ] Display posts in cards/list format
  - [ ] Add keyword management section
  - [ ] Keyword filter/tabs to view posts by keyword
- [ ] `/public/style.css` - Basic styling
- [ ] `/public/script.js` - Frontend JavaScript
  - [ ] Fetch posts on load
  - [ ] Add manual refresh button
  - [ ] Show loading states
  - [ ] Keyword management (add/remove/list)
  - [ ] Save keywords via `/api/keywords`
  - [ ] Filter posts by keyword using tabs or dropdown
  - [ ] Update URL params when filtering (e.g., `?keyword=javascript`)

### 6. Configure Vercel
- [ ] Create `vercel.json`:
  - [ ] Add cron job for `/api/fetch-reddit` (every 10 minutes)
  - [ ] Set Node.js version to 22
  - [ ] Configure redirects if needed
- [ ] Update `package.json`:
  - [ ] Add `@vercel/kv` dependency
  - [ ] Add `express` for local development
  - [ ] Remove `node-fetch` (native fetch in Node 22)
  - [ ] Update scripts for Vercel
  - [ ] Add `"dev": "node server.js"` script for local testing

### 7. Environment Variables
- [ ] Set up in Vercel dashboard:
  - [ ] `KV_URL` - Automatically set by Vercel
  - [ ] `KV_REST_API_URL` - Automatically set by Vercel
  - [ ] `KV_REST_API_TOKEN` - Automatically set by Vercel

### 8. Testing with Jest
- [ ] Install Jest and testing dependencies:
  - [ ] `jest` and `@types/jest`
  - [ ] `node-mocks-http` for API testing
  - [ ] `@vercel/kv` mock setup
- [ ] Create test files:
  - [ ] `/api/fetch-reddit.test.js` - Test Reddit fetching logic
    - [ ] Mock fetch calls to Reddit API
    - [ ] Test duplicate detection
    - [ ] Test error handling
  - [ ] `/api/posts.test.js` - Test posts retrieval
    - [ ] Mock KV storage responses
    - [ ] Test pagination
    - [ ] Test empty state
- [ ] Add test scripts to `package.json`:
  - [ ] `"test": "jest"`
  - [ ] `"test:watch": "jest --watch"`
  - [ ] `"test:coverage": "jest --coverage"`
- [ ] Configure `jest.config.js`:
  - [ ] Set test environment to `node`
  - [ ] Configure coverage thresholds
  - [ ] Set up module mocks
- [ ] Run tests before each deployment
- [ ] Aim for >80% code coverage

### 9. Final Vercel Integration
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Run `vercel dev` to test locally
- [ ] Test all endpoints
- [ ] Verify KV storage works
- [ ] Run Jest tests: `npm test`

### 10. Deployment
- [ ] Connect GitHub repo to Vercel
- [ ] Deploy with `vercel --prod`
- [ ] Verify cron job runs
- [ ] Test live endpoints
- [ ] Monitor logs for errors

### 11. Optional Enhancements
- [ ] Add search/filter functionality
- [ ] Implement webhook for real-time updates
- [ ] Add RSS feed endpoint
- [ ] Create admin endpoint to manually trigger fetches
- [ ] Add analytics to track popular keywords

## File Structure After Implementation
```
/api
  fetch-reddit.js
  fetch-reddit.test.js
  posts.js
  posts.test.js
  keywords.js
  keywords.test.js
/lib
  storage.js
/public
  index.html
  style.css
  script.js
server.js (for local development)
package.json
jest.config.js
vercel.json
plan.md
README.md
.gitignore
```

## Notes
- Vercel KV free tier: 3000 requests/day, 256MB storage
- Cron jobs run in UTC timezone
- Cron syntax for every 10 minutes: `*/10 * * * *`
- Serverless functions have 10-second timeout (default)
- Consider rate limiting to prevent abuse
- 144 fetches per day (every 10 min) is well within Reddit's limits