# Vercel Deployment Plan for Reddit Feed

## Project Setup Checklist

### 1. Prepare Project Structure
- [ ] Create `/api` directory for serverless functions
- [ ] Create `/public` directory for frontend files
- [ ] Move `reddit.js` logic into serverless function format

### 2. Create Serverless Functions
- [ ] `/api/fetch-reddit.js` - Convert reddit.js to serverless function
  - [ ] Remove file system operations (fs)
  - [ ] Replace JSON file storage with Vercel KV
  - [ ] Return JSON response instead of console output
- [ ] `/api/posts.js` - Endpoint to retrieve stored posts
  - [ ] Connect to Vercel KV
  - [ ] Return posts sorted by date
  - [ ] Add pagination support (optional)

### 3. Set Up Storage (Vercel KV)
- [ ] Enable Vercel KV in Vercel dashboard
- [ ] Install `@vercel/kv` package
- [ ] Create KV instance
- [ ] Update code to use KV instead of JSON files:
  - [ ] Store posted IDs in KV set
  - [ ] Store post data in KV with timestamp keys

### 4. Create Frontend
- [ ] `/public/index.html` - Main page
  - [ ] Simple, clean design
  - [ ] Fetch data from `/api/posts`
  - [ ] Display posts in cards/list format
- [ ] `/public/style.css` - Basic styling
- [ ] `/public/script.js` - Frontend JavaScript
  - [ ] Fetch posts on load
  - [ ] Add manual refresh button
  - [ ] Show loading states

### 5. Configure Vercel
- [ ] Create `vercel.json`:
  - [ ] Add cron job for `/api/fetch-reddit` (hourly)
  - [ ] Set Node.js version to 22
  - [ ] Configure redirects if needed
- [ ] Update `package.json`:
  - [ ] Add `@vercel/kv` dependency
  - [ ] Remove `node-fetch` (native fetch in Node 22)
  - [ ] Update scripts for Vercel

### 6. Environment Variables
- [ ] Set up in Vercel dashboard:
  - [ ] `KV_URL` - Automatically set by Vercel
  - [ ] `KV_REST_API_URL` - Automatically set by Vercel
  - [ ] `KV_REST_API_TOKEN` - Automatically set by Vercel
  - [ ] `REDDIT_KEYWORDS` - Optional, comma-separated keywords

### 7. Local Development
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Run `vercel dev` to test locally
- [ ] Test all endpoints
- [ ] Verify KV storage works

### 8. Deployment
- [ ] Connect GitHub repo to Vercel
- [ ] Deploy with `vercel --prod`
- [ ] Verify cron job runs
- [ ] Test live endpoints
- [ ] Monitor logs for errors

### 9. Optional Enhancements
- [ ] Add search/filter functionality
- [ ] Implement webhook for real-time updates
- [ ] Add RSS feed endpoint
- [ ] Create admin endpoint to manually trigger fetches
- [ ] Add analytics to track popular keywords

## File Structure After Implementation
```
/api
  fetch-reddit.js
  posts.js
/public
  index.html
  style.css
  script.js
package.json
vercel.json
plan.md
README.md
.gitignore
```

## Notes
- Vercel KV free tier: 3000 requests/day, 256MB storage
- Cron jobs run in UTC timezone
- Serverless functions have 10-second timeout (default)
- Consider rate limiting to prevent abuse