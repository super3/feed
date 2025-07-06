# Reddit Feed

A Node.js script that fetches and tracks Reddit posts by keyword, preventing duplicate entries and saving results to JSON files.

## Features

- Search Reddit posts by keyword
- Filter posts from the last hour
- Track previously fetched posts to avoid duplicates
- Save results to JSON files
- Console output with formatted post information

## Prerequisites

- Node.js (version 14.0.0 or higher)
- npm (Node Package Manager)

## Installation

1. Clone this repository or download the files
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Usage

### Basic Usage

Run the script with the default keyword "slack":

```bash
npm start
```

### Custom Keyword Search

Search for a specific keyword:

```bash
node reddit.js "your keyword"
```

Example:
```bash
node reddit.js "javascript"
```

## Output

The script generates two JSON files:

1. **reddit-data.json** - Stores IDs of previously fetched posts to prevent duplicates
2. **reddit-output.json** - Contains detailed information about all fetched posts

Each post includes:
- ID
- Title
- URL
- Subreddit
- Score
- Creation date
- Number of comments

## Console Output

The script displays real-time results in the console with:
- 🔍 Search status
- 📊 New posts found
- 🔴 Post titles
- 📍 Subreddit, score, and comment count
- 🔗 Reddit URL

## How It Works

1. The script searches Reddit's API for posts matching your keyword from the last hour
2. It checks against previously fetched post IDs to avoid duplicates
3. New posts are saved to both tracking and output files
4. Results are displayed in the console

## Files Generated

- `reddit-data.json` - Tracking file for posted IDs
- `reddit-output.json` - Detailed post information

## Note

This script uses Reddit's public JSON API which doesn't require authentication. Be mindful of rate limits when running the script frequently.