# Reddit Feed

A modern Reddit post aggregator with AI-powered content filtering built with [Node.js](https://nodejs.org), [Express](https://expressjs.com), and [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript).

[![Test Status](https://img.shields.io/github/actions/workflow/status/super3/feed/test.yml?label=tests)](https://github.com/super3/feed/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/super3/feed/badge.svg?branch=main)](https://coveralls.io/github/super3/feed?branch=main)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?label=license)](https://github.com/super3/feed/blob/main/LICENSE)

## Quick Start
```bash
git clone https://github.com/super3/feed.git && cd feed
npm install && npm test
npm run dev
```

Open `http://localhost:3000` in your browser to start using Reddit Feed.

## 🚀 Features

- **Keyword Tracking**: Monitor multiple keywords across Reddit with contextual descriptions
- **Smart Filtering**: AI-powered relevance filtering using LM Studio integration
- **Real-time Updates**: Fetch new posts from the last hour with duplicate detection
- **Clean UI**: Responsive design with expandable post details and visual indicators
- **Progressive Filtering**: Watch as AI analyzes each post in real-time

## 🔧 Configuration

### LM Studio Setup

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load a compatible model (e.g., Llama, Mistral, DeepSeek)
3. Start the local server on `http://localhost:1234`
4. The app will automatically connect when filtering

### Environment Variables
```bash
PORT=3000                           # Server port (default: 3000)
LM_STUDIO_URL="http://localhost:1234"  # LM Studio server URL
LM_STUDIO_MODEL="your-model-name"      # Optional: Specify model
LM_STUDIO_TIMEOUT="60000"              # Request timeout in ms
LM_STUDIO_BATCH_SIZE="3"               # Concurrent filter requests
```

## 📁 Project Structure
```
feed/
├── api/           # API endpoints
├── lib/           # Shared utilities
├── public/        # Frontend assets
├── data/          # Local storage (git-ignored)
└── server.js      # Express server
```

## 🧪 Testing

Run the test suite:
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Generate coverage report
```