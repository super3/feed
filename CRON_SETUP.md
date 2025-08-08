# External Cron Setup Guide

Since Vercel Hobby plan only allows daily cron jobs, we recommend using an external cron service for more frequent updates.

## Using cron-job.org (Free)

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job with these settings:

### Option 1: Use the dedicated cron endpoint
- **URL**: `https://your-app.vercel.app/api/cron/fetch-posts`
- **Schedule**: Every 10 minutes (or your preferred interval)
- **Request Method**: GET

### Option 2: Use the regular fetch endpoint  
- **URL**: `https://your-app.vercel.app/api/fetch-reddit`
- **Schedule**: Every 10 minutes (or your preferred interval)
- **Request Method**: POST or GET

## Adding Authentication (Optional)

If you want to secure your cron endpoint:

1. Add `CRON_SECRET` environment variable in Vercel:
   ```
   CRON_SECRET=your-secret-key-here
   ```

2. In cron-job.org, add a custom header:
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer your-secret-key-here`

## Alternative Services

- **EasyCron**: [easycron.com](https://www.easycron.com) - Free tier available
- **Uptime Robot**: [uptimerobot.com](https://uptimerobot.com) - Can be used as a cron alternative
- **GitHub Actions**: Can schedule workflows to call your endpoint

## Testing

You can test the endpoints manually:

```bash
# Test cron endpoint
curl https://your-app.vercel.app/api/cron/fetch-posts

# Test regular fetch endpoint
curl -X POST https://your-app.vercel.app/api/fetch-reddit
```

## Notes

- The `/api/cron/fetch-posts` endpoint is identical to `/api/fetch-reddit` but designed for cron usage
- Both endpoints fetch posts for all configured keywords
- Posts are automatically deduplicated based on Reddit post ID
- Failed fetches for individual keywords won't stop processing of other keywords