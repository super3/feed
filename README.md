# Reddit Feed

[![Run Tests](https://github.com/super3/feed/actions/workflows/test.yml/badge.svg)](https://github.com/super3/feed/actions/workflows/test.yml)

Fetches and tracks Reddit posts by keyword, preventing duplicates and saving results to JSON.

## Setup

Requires Node.js 22+

```bash
npm install
```

## Usage

```bash
# Default search (keyword: "slack")
npm start

# Custom keyword
node reddit.js "javascript"
```

## Output

- **reddit-data.json** - Tracks fetched post IDs to prevent duplicates
- **reddit-output.json** - Full post details (title, URL, subreddit, score, etc.)

Console shows real-time results with formatted post information.

## How It Works

1. Searches Reddit for posts from the last hour matching your keyword
2. Filters out previously fetched posts
3. Saves new posts to JSON files
4. Displays results in console

Uses Reddit's public JSON API (no auth required). Be mindful of rate limits.