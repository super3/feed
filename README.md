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

## Web Interface

The app includes a web interface for managing keywords and viewing posts:

```bash
npm run dev  # Start development server
```

Then open http://localhost:3000 in your browser.

## Testing

```bash
npm test     # Run all tests
npm run test:coverage  # Run tests with coverage report
```

## AI Context Filtering

The app supports AI-powered context filtering using a local LM Studio server. This allows you to filter posts based on contextual relevance.

### Setup

1. Install and run [LM Studio](https://lmstudio.ai/)
2. Load a model (tested with `deepseek/deepseek-r1-0528-qwen3-8b`)
3. Start the LM Studio server (default: http://localhost:1234)

### Configuration

You can configure the LM Studio connection using environment variables:

```bash
# Optional: Specify a different model
export LM_STUDIO_MODEL="your-model-name"

# Optional: Specify a different LM Studio URL
export LM_STUDIO_URL="http://localhost:8080"

# Optional: Specify request timeout in milliseconds (default: 60000)
export LM_STUDIO_TIMEOUT="120000"  # 2 minutes

# Optional: Specify batch size for concurrent requests (default: 3)
export LM_STUDIO_BATCH_SIZE="2"  # Process 2 posts at a time
```

### Usage

1. Filter posts by a keyword (e.g., "obsidian")
2. Click "Filter by Context" button
3. Enter context (e.g., "the note-taking app")
4. Click "Apply Filter"

The AI will analyze each post and determine if it matches your specific context.

### Note on DeepSeek Models

DeepSeek models may include thinking tags in their responses. The filter API automatically handles these and extracts the YES/NO answer.