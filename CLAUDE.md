# Claude Code Guidelines for Reddit Feed Project

## Project Overview
Reddit Feed Aggregator that fetches posts by keyword with web interface. Uses Redis/Upstash for persistent storage on Vercel deployment.

## Key Technical Details
- **Storage**: Upstash Redis (REDIS_URL or KV_URL env vars) for Vercel, local file storage for development
- **Proxy**: ProxyMesh credentials for Reddit API access (PROXY_USER, PROXY_PASS, PROXY_HOST)
- **Cron Jobs**: Use external service (e.g., cron-job.org) to call `/api/cron/fetch-posts` or `/api/fetch-reddit`

## Important Guidelines

### Testing
- Always run tests before starting work: `npm test` (understand the current state)
- Always run tests before committing: `npm test` (verify your changes)
- Coverage threshold: 78% branches, 80% functions/lines/statements

### Git Workflow
- **NEVER commit or push without explicit user permission**
- Always run tests before committing
- Use descriptive commit messages explaining what changed and why

### Code Standards
- No unnecessary comments unless specifically requested
- Follow existing code patterns and conventions
- Use existing libraries - don't assume new ones are available
- Check package.json before using any library

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